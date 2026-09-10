/**
 * game-core.js
 * 
 * Deterministic state reducer, safeguard gates, and scoring engine for
 * Data & Access Risk Triage.
 * 
 * Pure functions only: no DOM, no localStorage, no Math.random(), no clock.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Create an initial game state.
   * @param {string} initialLens - '305332' | '316332' | 'shared'
   */
  function createInitialState(initialLens) {
    var lens = initialLens || '305332';
    return {
      activeLens: lens, // '305332' | '316332' | 'shared'
      currentRound: 1, // 1 to 4, 5 is debrief
      round1: {
        completed: false,
        mappings: {},
        evidenceAnswer: null,
        score: { scope: 0, proportionality: 0, evidence: 0, accountability: 0 }
      },
      round2: {
        completed: false,
        selectedDecisionId: null,
        safeguardTriggered: null,
        score: { scope: 0, proportionality: 0, evidence: 0, accountability: 0 }
      },
      round3: {
        completed: false,
        likelihood: null,
        impact: null,
        confidence: null,
        safeguardTriggered: null,
        priority: null,
        score: { scope: 0, proportionality: 0, evidence: 0, accountability: 0 }
      },
      round4: {
        completed: false,
        treatmentId: null,
        ownerId: null,
        evidenceId: null,
        residualRisk: null,
        score: { scope: 0, proportionality: 0, evidence: 0, accountability: 0 }
      },
      scoresByLens: {
        '305332': { scope: 0, proportionality: 0, evidence: 0, accountability: 0, total: 0 },
        '316332': { scope: 0, proportionality: 0, evidence: 0, accountability: 0, total: 0 }
      },
      decisionTrail: []
    };
  }

  /**
   * Check Evidence Limiter Gate:
   * Prevents high confidence claim when fact is missing or unknown.
   */
  function checkEvidenceLimiter(confidenceId, hasUnknowns) {
    if (confidenceId === 'high' && hasUnknowns) {
      return {
        allowed: false,
        gate: 'evidence_limiter',
        code: 'BLOCKED_HIGH_CONFIDENCE_ON_UNKNOWN',
        reason: 'Evidence Limiter Gate: High certainty claim is blocked because critical case facts remain unknown or unverified.'
      };
    }
    return { allowed: true, gate: 'evidence_limiter' };
  }

  /**
   * Check Scope Gate:
   * Rejects overprivileged access or overbroad database dumps.
   */
  function checkScopeGate(decisionType) {
    if (decisionType === 'overprivileged' || decisionType === 'overbroad_export') {
      return {
        allowed: false,
        gate: 'scope_gate',
        code: 'BLOCKED_OVERBROAD_SCOPE',
        reason: 'Scope Gate: Rejected due to violation of least privilege or data minimisation.'
      };
    }
    return { allowed: true, gate: 'scope_gate' };
  }

  /**
   * Check Human-Approval Gate:
   * Prevents non-person entities or unauthorized roles from approving changes or access.
   */
  function checkHumanApprovalGate(actorId, actionType) {
    if (actorId === 'automated_reminder_worker' || actorId === 'vendor_support' || actorId === 'volunteer') {
      if (actionType === 'grant_privilege' || actionType === 'approve_export' || actionType === 'modify_role') {
        return {
          allowed: false,
          gate: 'human_approval_gate',
          code: 'BLOCKED_UNAUTHORIZED_ENTITY_APPROVAL',
          reason: 'Human-Approval Gate: Automated workers or delegated third-parties cannot approve role changes or sensitive data sharing.'
        };
      }
    }
    return { allowed: true, gate: 'human_approval_gate' };
  }

  /**
   * Compute Risk Priority from Likelihood and Impact.
   */
  function computeRiskPriority(likelihood, impact) {
    var l = (likelihood || '').toLowerCase();
    var i = (impact || '').toLowerCase();

    if (i === 'critical' || (l === 'high' && i === 'moderate')) {
      return 'High';
    }
    if ((l === 'high' && i === 'minor') || (l === 'moderate' && i === 'moderate') || (l === 'low' && i === 'critical')) {
      return 'Medium';
    }
    return 'Low';
  }

  /**
   * Calculate Residual Risk.
   * Safety constraint: Controls reduce risk but residual risk is NEVER 'None' or zero.
   */
  function calculateResidualRisk(treatmentIsValid, initialPriority) {
    if (!treatmentIsValid) {
      return {
        level: initialPriority || 'High',
        isAcceptable: false,
        explanation: 'Treatment is ineffective or administrative-only. Inherent risk remains unmitigated.'
      };
    }
    return {
      level: 'Low',
      isAcceptable: true,
      explanation: 'Technical and governance controls reduce systemic risk. Residual operational and human risks remain documented and monitored.'
    };
  }

  /**
   * Reducer: Submit Round 1 (Map)
   */
  function submitRound1(state, pack, userSelections) {
    var newState = JSON.parse(JSON.stringify(state));
    var lens = newState.activeLens === 'shared' ? '305332' : newState.activeLens;
    var roundData = pack.rounds.round1_map;

    var mappings = userSelections.mappings || {};
    var evidenceAnswer = userSelections.evidenceAnswer;

    var scopeScore = 0;
    var evidenceScore = 0;

    // Check mappings
    var totalTasks = roundData.mapping_tasks.length;
    var correctTasks = 0;
    roundData.mapping_tasks.forEach(function (task) {
      var key = task.actor_id || task.asset_id;
      var expected = task.correct_type || task.correct_sensitivity;
      if (mappings[key] === expected) {
        correctTasks += 1;
      }
    });

    if (totalTasks > 0) {
      scopeScore = Math.round((correctTasks / totalTasks) * 25);
    }

    // Check evidence answer
    if (evidenceAnswer === roundData.evidence_check.correct_id) {
      evidenceScore = 25;
    }

    newState.round1 = {
      completed: true,
      mappings: mappings,
      evidenceAnswer: evidenceAnswer,
      score: {
        scope: scopeScore,
        proportionality: 25,
        evidence: evidenceScore,
        accountability: 25
      }
    };

    updateLensScore(newState, lens, 1, newState.round1.score);
    newState.decisionTrail.push({
      round: 1,
      lens: lens,
      summary: 'Completed mapping and evidence check with ' + correctTasks + '/' + totalTasks + ' correct items.'
    });

    newState.currentRound = 2;
    return newState;
  }

  /**
   * Reducer: Submit Round 2 (Access Decision)
   */
  function submitRound2(state, pack, decisionId) {
    var newState = JSON.parse(JSON.stringify(state));
    var lens = newState.activeLens === 'shared' ? '305332' : newState.activeLens;
    var roundData = pack.rounds.round2_access;

    var selected = null;
    for (var i = 0; i < roundData.decisions.length; i++) {
      if (roundData.decisions[i].id === decisionId) {
        selected = roundData.decisions[i];
        break;
      }
    }

    if (!selected) {
      throw new Error('Invalid decision ID: ' + decisionId);
    }

    // Check safeguard gates
    var scopeGate = checkScopeGate(selected.type);
    var humanApprovalGate = selected.type === 'unsafe_automation'
      ? checkHumanApprovalGate('automated_reminder_worker', 'modify_role')
      : { allowed: true };

    var safeguardTriggered = null;
    if (!scopeGate.allowed) {
      safeguardTriggered = 'scope_gate';
    } else if (!humanApprovalGate.allowed) {
      safeguardTriggered = 'human_approval_gate';
    }

    var score = selected.score_impact;

    newState.round2 = {
      completed: true,
      selectedDecisionId: decisionId,
      safeguardTriggered: safeguardTriggered,
      score: score
    };

    updateLensScore(newState, lens, 2, score);
    newState.decisionTrail.push({
      round: 2,
      lens: lens,
      decisionId: decisionId,
      safeguardTriggered: safeguardTriggered,
      summary: 'Access decision evaluated: ' + (safeguardTriggered ? 'Blocked by ' + safeguardTriggered : 'Approved valid path')
    });

    newState.currentRound = 3;
    return newState;
  }

  /**
   * Reducer: Submit Round 3 (Risk Triage)
   */
  function submitRound3(state, pack, triageData) {
    var newState = JSON.parse(JSON.stringify(state));
    var lens = newState.activeLens === 'shared' ? '305332' : newState.activeLens;
    var roundData = pack.rounds.round3_triage.risk_dimensions;

    var likelihood = triageData.likelihood;
    var impact = triageData.impact;
    var confidence = triageData.confidence;

    // Check evidence limiter: case facts contain explicit unknowns
    var limiterCheck = checkEvidenceLimiter(confidence, true);
    var safeguardTriggered = limiterCheck.allowed ? null : 'evidence_limiter';

    var priority = computeRiskPriority(likelihood, impact);

    var score = {
      scope: 25,
      proportionality: (likelihood === roundData.expected_likelihood && impact === roundData.expected_impact) ? 25 : 10,
      evidence: limiterCheck.allowed && confidence === roundData.expected_confidence ? 25 : 5,
      accountability: 25
    };

    newState.round3 = {
      completed: true,
      likelihood: likelihood,
      impact: impact,
      confidence: confidence,
      safeguardTriggered: safeguardTriggered,
      priority: priority,
      score: score
    };

    updateLensScore(newState, lens, 3, score);
    newState.decisionTrail.push({
      round: 3,
      lens: lens,
      priority: priority,
      confidence: confidence,
      safeguardTriggered: safeguardTriggered,
      summary: 'Risk evaluated as ' + priority + ' priority with ' + confidence + ' confidence.'
    });

    newState.currentRound = 4;
    return newState;
  }

  /**
   * Reducer: Submit Round 4 (Treat & Govern)
   */
  function submitRound4(state, pack, treatmentData) {
    var newState = JSON.parse(JSON.stringify(state));
    var lens = newState.activeLens === 'shared' ? '305332' : newState.activeLens;
    var roundData = pack.rounds.round4_treat;

    var treatmentId = treatmentData.treatmentId;
    var ownerId = treatmentData.ownerId;
    var evidenceId = treatmentData.evidenceId;

    var selectedTreatment = null;
    for (var i = 0; i < roundData.treatment_options.length; i++) {
      if (roundData.treatment_options[i].id === treatmentId) {
        selectedTreatment = roundData.treatment_options[i];
        break;
      }
    }

    var selectedOwnerValid = false;
    for (var j = 0; j < roundData.accountable_owner_options.length; j++) {
      if (roundData.accountable_owner_options[j].id === ownerId) {
        selectedOwnerValid = !!roundData.accountable_owner_options[j].valid;
        break;
      }
    }

    var selectedEvidenceValid = false;
    for (var k = 0; k < roundData.verification_evidence_options.length; k++) {
      if (roundData.verification_evidence_options[k].id === evidenceId) {
        selectedEvidenceValid = !!roundData.verification_evidence_options[k].valid;
        break;
      }
    }

    var isTreatmentValid = selectedTreatment && selectedTreatment.is_valid;
    var residual = calculateResidualRisk(isTreatmentValid, newState.round3.priority);

    var score = {
      scope: isTreatmentValid ? 25 : 5,
      proportionality: isTreatmentValid ? 25 : 5,
      evidence: selectedEvidenceValid ? 25 : 0,
      accountability: selectedOwnerValid ? 25 : 0
    };

    newState.round4 = {
      completed: true,
      treatmentId: treatmentId,
      ownerId: ownerId,
      evidenceId: evidenceId,
      residualRisk: residual,
      score: score
    };

    updateLensScore(newState, lens, 4, score);
    newState.decisionTrail.push({
      round: 4,
      lens: lens,
      treatmentId: treatmentId,
      ownerValid: selectedOwnerValid,
      evidenceValid: selectedEvidenceValid,
      residualLevel: residual.level,
      summary: 'Treatment applied with residual risk: ' + residual.level
    });

    newState.currentRound = 5; // Debrief
    return newState;
  }

  /**
   * Helper: Update dimensional scores for a lens.
   */
  function updateLensScore(state, lens, roundNumber, roundScore) {
    if (!state.scoresByLens[lens]) {
      state.scoresByLens[lens] = { scope: 0, proportionality: 0, evidence: 0, accountability: 0, total: 0 };
    }
    var target = state.scoresByLens[lens];
    target.scope = Math.min(100, target.scope + (roundScore.scope || 0));
    target.proportionality = Math.min(100, target.proportionality + (roundScore.proportionality || 0));
    target.evidence = Math.min(100, target.evidence + (roundScore.evidence || 0));
    target.accountability = Math.min(100, target.accountability + (roundScore.accountability || 0));
    target.total = Math.round((target.scope + target.proportionality + target.evidence + target.accountability) / 4);
  }

  /**
   * Validate a Course Pack schema and required fields.
   */
  function validatePackSchema(pack) {
    var errors = [];
    if (!pack.course_code) errors.push('Missing course_code');
    if (!pack.lens_title || !pack.lens_title.en || !pack.lens_title.th) errors.push('Missing bilingual lens_title');
    if (!pack.rounds) {
      errors.push('Missing rounds block');
      return { valid: false, errors: errors };
    }

    ['round1_map', 'round2_access', 'round3_triage', 'round4_treat'].forEach(function (r) {
      if (!pack.rounds[r]) {
        errors.push('Missing ' + r);
      }
    });

    // Check round 2 safeguard coverage
    if (pack.rounds.round2_access && Array.isArray(pack.rounds.round2_access.decisions)) {
      var hasValid = pack.rounds.round2_access.decisions.some(function (d) { return d.type === 'valid_scoped'; });
      var hasOverbroad = pack.rounds.round2_access.decisions.some(function (d) {
        return d.type === 'overprivileged' || d.type === 'overbroad_export';
      });
      if (!hasValid) errors.push('Round 2 missing valid_scoped decision');
      if (!hasOverbroad) errors.push('Round 2 missing overbroad decision testing scope gate');
    }

    // Check round 3 limiter
    if (pack.rounds.round3_triage && pack.rounds.round3_triage.risk_dimensions) {
      var limiter = pack.rounds.round3_triage.risk_dimensions.limiter_rule;
      if (!limiter || limiter.blocked_level !== 'high') {
        errors.push('Round 3 missing limiter_rule blocking high certainty');
      }
    }

    // Check debrief
    if (!pack.debrief || !pack.debrief.summary_template) {
      errors.push('Missing debrief block or summary_template');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  return {
    createInitialState: createInitialState,
    checkEvidenceLimiter: checkEvidenceLimiter,
    checkScopeGate: checkScopeGate,
    checkHumanApprovalGate: checkHumanApprovalGate,
    computeRiskPriority: computeRiskPriority,
    calculateResidualRisk: calculateResidualRisk,
    submitRound1: submitRound1,
    submitRound2: submitRound2,
    submitRound3: submitRound3,
    submitRound4: submitRound4,
    validatePackSchema: validatePackSchema
  };
});
