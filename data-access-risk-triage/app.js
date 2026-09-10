/**
 * app.js
 * Browser controller for Data & Access Risk Triage with Instructor-Guided Projector Mode.
 */

(function () {
  'use strict';

  var currentLang = 'th';
  var isProjectorMode = false;
  var isInstructorMode = true; // default enabled for facilitator awareness
  var gameState = null;
  var sharedPack = null;
  var currentCoursePack = null;
  var packs = {};

  // Timers
  var activeTimerInterval = null;
  var timerSecondsRemaining = 60;
  var timerRunning = false;

  // DOM Elements
  var progressContainer = document.getElementById('progress-container');
  var activeLensBadge = document.getElementById('active-lens-badge');
  var btnToggleLang = document.getElementById('btn-toggle-lang');
  var btnToggleProjector = document.getElementById('btn-toggle-projector');
  var btnToggleInstructor = document.getElementById('btn-toggle-instructor');
  var btnToggleGlossary = document.getElementById('btn-toggle-glossary');
  var btnCloseGlossary = document.getElementById('btn-close-glossary');
  var glossaryModal = document.getElementById('glossary-modal');
  var glossaryList = document.getElementById('glossary-list');

  // Screens
  var screens = {
    lens: document.getElementById('screen-lens'),
    round1: document.getElementById('screen-round1'),
    round2: document.getElementById('screen-round2'),
    round3: document.getElementById('screen-round3'),
    round4: document.getElementById('screen-round4'),
    debrief: document.getElementById('screen-debrief')
  };

  function init() {
    try {
      var savedLang = localStorage.getItem('dart_lang');
      if (savedLang === 'en' || savedLang === 'th') {
        currentLang = savedLang;
      }
      var savedProj = localStorage.getItem('dart_projector_mode');
      if (savedProj === 'true') {
        isProjectorMode = true;
      }
      var savedInst = localStorage.getItem('dart_instructor_mode');
      if (savedInst !== null) {
        isInstructorMode = savedInst === 'true';
      }
    } catch (e) {}

    updateProjectorClass();
    updateInstructorClass();

    setupEventListeners();
    loadPacks(function () {
      applyLanguage(currentLang);
      renderArchitectureDiagram();
      showScreen('lens');
    });
  }

  function setupEventListeners() {
    // Language Toggle
    btnToggleLang.addEventListener('click', function () {
      currentLang = currentLang === 'th' ? 'en' : 'th';
      try { localStorage.setItem('dart_lang', currentLang); } catch (e) {}
      applyLanguage(currentLang);
      renderArchitectureDiagram();
      renderCurrentScreen();
    });

    // Projector Mode Toggle
    btnToggleProjector.addEventListener('click', function () {
      isProjectorMode = !isProjectorMode;
      try { localStorage.setItem('dart_projector_mode', isProjectorMode.toString()); } catch (e) {}
      updateProjectorClass();
    });

    // Instructor Guide Toggle
    btnToggleInstructor.addEventListener('click', function () {
      isInstructorMode = !isInstructorMode;
      try { localStorage.setItem('dart_instructor_mode', isInstructorMode.toString()); } catch (e) {}
      updateInstructorClass();
    });

    // Glossary Modal
    btnToggleGlossary.addEventListener('click', openGlossary);
    btnCloseGlossary.addEventListener('click', closeGlossary);
    glossaryModal.addEventListener('click', function (e) {
      if (e.target === glossaryModal) closeGlossary();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && glossaryModal.classList.contains('active')) {
        closeGlossary();
      }
    });

    // Lens selector buttons
    var lensCards = document.querySelectorAll('.lens-card');
    lensCards.forEach(function (card) {
      card.addEventListener('click', function () {
        var lens = card.getAttribute('data-lens');
        startWithLens(lens);
      });
    });

    // Timers setup
    setupClassTimers();

    // Round submit buttons
    document.getElementById('btn-submit-r1').addEventListener('click', submitRound1Action);
    document.getElementById('btn-submit-r2').addEventListener('click', function () {
      showScreen('round3');
      renderRound3();
    });
    document.getElementById('btn-submit-r3').addEventListener('click', submitRound3Action);
    document.getElementById('btn-submit-r4').addEventListener('click', submitRound4Action);

    // Restart button
    document.getElementById('btn-restart-activity').addEventListener('click', function () {
      showScreen('lens');
    });
  }

  function updateProjectorClass() {
    if (isProjectorMode) {
      document.body.classList.add('projector-mode');
      btnToggleProjector.classList.add('btn-active');
    } else {
      document.body.classList.remove('projector-mode');
      btnToggleProjector.classList.remove('btn-active');
    }
  }

  function updateInstructorClass() {
    var boxes = document.querySelectorAll('.instructor-callout');
    boxes.forEach(function (box) {
      box.style.display = isInstructorMode ? 'block' : 'none';
    });
    if (isInstructorMode) {
      btnToggleInstructor.classList.add('btn-active');
    } else {
      btnToggleInstructor.classList.remove('btn-active');
    }
  }

  function setupClassTimers() {
    [1, 2, 3, 4].forEach(function (r) {
      var display = document.getElementById('timer-display-r' + r);
      var toggleBtn = document.getElementById('btn-timer-toggle-r' + r);
      if (!toggleBtn) return;

      var presetBtns = document.querySelectorAll('#r' + r + '-instructor-box button[data-timer-set]');
      presetBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          clearInterval(activeTimerInterval);
          timerRunning = false;
          timerSecondsRemaining = parseInt(btn.getAttribute('data-timer-set'), 10);
          updateTimerDisplay(display, timerSecondsRemaining);
          toggleBtn.textContent = 'Start';
          toggleBtn.className = 'btn btn-primary';
        });
      });

      toggleBtn.addEventListener('click', function () {
        if (timerRunning) {
          clearInterval(activeTimerInterval);
          timerRunning = false;
          toggleBtn.textContent = 'Resume';
          toggleBtn.className = 'btn btn-secondary';
        } else {
          timerRunning = true;
          toggleBtn.textContent = 'Pause';
          toggleBtn.className = 'btn btn-outline';
          activeTimerInterval = setInterval(function () {
            timerSecondsRemaining--;
            if (timerSecondsRemaining <= 0) {
              clearInterval(activeTimerInterval);
              timerRunning = false;
              toggleBtn.textContent = 'Time Up!';
              toggleBtn.className = 'btn btn-active';
            }
            updateTimerDisplay(display, Math.max(0, timerSecondsRemaining));
          }, 1000);
        }
      });
    });
  }

  function updateTimerDisplay(el, seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    el.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function loadPacks(callback) {
    Promise.all([
      fetch('packs/shared.json').then(function (r) { return r.json(); }),
      fetch('packs/305332.json').then(function (r) { return r.json(); }),
      fetch('packs/316332.json').then(function (r) { return r.json(); })
    ]).then(function (results) {
      sharedPack = results[0];
      packs['305332'] = results[1];
      packs['316332'] = results[2];
      callback();
    }).catch(function (err) {
      console.error('Failed to load JSON packs:', err);
    });
  }

  function startWithLens(lens) {
    var actualPackCode = (lens === '316332') ? '316332' : '305332';
    currentCoursePack = packs[actualPackCode];
    gameState = GameCore.createInitialState(lens);

    progressContainer.style.display = 'block';
    updateProgressStep(1);
    updateLensBadge();

    showScreen('round1');
    renderRound1();
  }

  function showScreen(screenKey) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.remove('active');
    });
    if (screens[screenKey]) {
      screens[screenKey].classList.add('active');
      window.scrollTo(0, 0);
    }
  }

  function updateProgressStep(stepNum) {
    for (var i = 1; i <= 5; i++) {
      var el = document.getElementById('step-nav-' + i);
      if (!el) continue;
      el.classList.remove('active', 'completed');
      if (i < stepNum) {
        el.classList.add('completed');
      } else if (i === stepNum) {
        el.classList.add('active');
      }
    }
  }

  function updateLensBadge() {
    if (!gameState) return;
    var label = gameState.activeLens === 'shared' ? 'Shared Practice' : ('Course Lens: ' + gameState.activeLens);
    activeLensBadge.textContent = label;
  }

  function applyLanguage(lang) {
    document.documentElement.lang = lang;
    btnToggleLang.textContent = lang === 'th' ? 'EN' : 'TH';
    document.getElementById('app-title').textContent = I18N.get(lang, 'appName');
    document.getElementById('app-subtitle').textContent = I18N.get(lang, 'appSubtitle');
    btnToggleProjector.textContent = I18N.get(lang, 'btnProjectorMode');
    btnToggleInstructor.textContent = I18N.get(lang, 'btnInstructorMode');
    document.getElementById('btn-toggle-glossary').textContent = I18N.get(lang, 'btnGlossary');
    document.getElementById('btn-back-portal').textContent = I18N.get(lang, 'backToPortal');

    // Lens screen texts
    document.getElementById('txt-lens-title').textContent = I18N.get(lang, 'lensSelectorTitle');
    document.getElementById('txt-lens-subtitle').textContent = I18N.get(lang, 'lensSelectorSubtitle');
    document.getElementById('txt-lens-305-title').textContent = I18N.get(lang, 'lens305332Title');
    document.getElementById('txt-lens-305-desc').textContent = I18N.get(lang, 'lens305332Desc');
    document.getElementById('txt-lens-316-title').textContent = I18N.get(lang, 'lens316332Title');
    document.getElementById('txt-lens-316-desc').textContent = I18N.get(lang, 'lens316332Desc');
    document.getElementById('txt-lens-shared-title').textContent = I18N.get(lang, 'lensSharedTitle');
    document.getElementById('txt-lens-shared-desc').textContent = I18N.get(lang, 'lensSharedDesc');

    // Ticket box
    document.getElementById('txt-ticket-header').textContent = I18N.get(lang, 'ticketTitle') + ': CR-2026-0910-CC';
    if (sharedPack && sharedPack.change_request_ticket) {
      var cr = sharedPack.change_request_ticket;
      document.getElementById('txt-ticket-summary').textContent = (cr.requestor[lang] || cr.requestor.en) + ' — ' + (cr.change_summary[lang] || cr.change_summary.en);
      document.getElementById('txt-ticket-snippet').textContent = cr.vendor_email_snippet[lang] || cr.vendor_email_snippet.en;
    }

    renderGlossary();
  }

  function renderArchitectureDiagram() {
    if (!sharedPack || !sharedPack.architecture_diagram) return;
    var arch = sharedPack.architecture_diagram;
    document.getElementById('txt-arch-title').textContent = arch.title[currentLang] || arch.title.en;

    var nodesContainer = document.getElementById('arch-nodes-container');
    nodesContainer.innerHTML = arch.components.map(function (node) {
      var name = node.name[currentLang] || node.name.en;
      var detail = node.detail[currentLang] || node.detail.en;
      return '<div class="arch-node">' +
        '<div class="arch-node-title">' + name + '</div>' +
        '<div class="arch-node-detail">' + detail + '</div>' +
        '</div>';
    }).join('');

    var flowsContainer = document.getElementById('arch-flows-container');
    flowsContainer.innerHTML = arch.flows.map(function (flow) {
      var fromNode = arch.components.find(function (c) { return c.id === flow.from; });
      var toNode = arch.components.find(function (c) { return c.id === flow.to; });
      var fromName = (fromNode && (fromNode.name[currentLang] || fromNode.name.en)) || flow.from;
      var toName = (toNode && (toNode.name[currentLang] || toNode.name.en)) || flow.to;
      var label = flow.label[currentLang] || flow.label.en;

      return '<div class="arch-flow-item">' +
        '<strong>' + fromName + '</strong>' +
        '<span class="arch-flow-arrow">➔</span>' +
        '<strong>' + toName + ':</strong> ' +
        '<span>' + label + '</span>' +
        '</div>';
    }).join('');
  }

  function openGlossary() {
    glossaryModal.classList.add('active');
    document.getElementById('btn-close-glossary').focus();
  }

  function closeGlossary() {
    glossaryModal.classList.remove('active');
    btnToggleGlossary.focus();
  }

  function renderGlossary() {
    var terms = I18N.getTranslations(currentLang).glossary || [];
    glossaryList.innerHTML = terms.map(function (item) {
      return '<div class="glossary-item">' +
        '<div class="glossary-term">' + item.term + '</div>' +
        '<div class="glossary-def">' + item.def + '</div>' +
        '</div>';
    }).join('');
  }

  function renderCurrentScreen() {
    if (!gameState) return;
    updateLensBadge();
    if (screens.round1.classList.contains('active')) renderRound1();
    if (screens.round2.classList.contains('active')) renderRound2();
    if (screens.round3.classList.contains('active')) renderRound3();
    if (screens.round4.classList.contains('active')) renderRound4();
    if (screens.debrief.classList.contains('active')) renderDebrief();
  }

  // --- Round 1 Rendering ---
  function renderRound1() {
    updateProgressStep(1);
    var r1 = currentCoursePack.rounds.round1_map;
    document.getElementById('r1-title').textContent = r1.title[currentLang] || r1.title.en;
    document.getElementById('r1-instruction').textContent = r1.instruction[currentLang] || r1.instruction.en;

    // Instructor prompt
    if (r1.instructor_prompt) {
      document.getElementById('r1-instructor-prompt').textContent = r1.instructor_prompt[currentLang] || r1.instructor_prompt.en;
    }

    var container = document.getElementById('r1-tasks-container');
    container.innerHTML = r1.mapping_tasks.map(function (task, idx) {
      var key = task.actor_id || task.asset_id;
      var nameObj = findEntityName(key);
      var displayName = (nameObj && (nameObj[currentLang] || nameObj.en)) || key;

      var optionsHtml = task.options.map(function (opt) {
        return '<label style="margin-right: 1.25rem; cursor: pointer; font-size: 0.95rem;">' +
          '<input type="radio" name="r1_task_' + idx + '" value="' + opt + '"> ' +
          opt.replace('_', ' ') +
          '</label>';
      }).join('');

      return '<div class="choice-card">' +
        '<div class="choice-title">' + displayName + '</div>' +
        '<div style="margin-top: 0.6rem;">' + optionsHtml + '</div>' +
        '</div>';
    }).join('');

    // Evidence check question
    var evCheck = r1.evidence_check;
    document.getElementById('r1-ev-question').textContent = evCheck.question[currentLang] || evCheck.question.en;
    var evContainer = document.getElementById('r1-ev-options');
    evContainer.innerHTML = evCheck.options.map(function (opt) {
      var label = opt.label[currentLang] || opt.label.en;
      return '<label class="choice-card" style="display: block; cursor: pointer;">' +
        '<input type="radio" name="r1_evidence_opt" value="' + opt.id + '"> ' +
        '<span>' + label + '</span>' +
        '</label>';
    }).join('');

    document.getElementById('r1-feedback').style.display = 'none';
    updateInstructorClass();
  }

  function findEntityName(id) {
    if (!sharedPack) return null;
    var role = sharedPack.service_roles.find(function (r) { return r.id === id; });
    if (role) return role.name;
    var asset = sharedPack.data_assets.find(function (a) { return a.id === id; });
    if (asset) return asset.name;
    return null;
  }

  function submitRound1Action() {
    var r1 = currentCoursePack.rounds.round1_map;
    var mappings = {};
    r1.mapping_tasks.forEach(function (task, idx) {
      var key = task.actor_id || task.asset_id;
      var checked = document.querySelector('input[name="r1_task_' + idx + '"]:checked');
      if (checked) mappings[key] = checked.value;
    });

    var evChecked = document.querySelector('input[name="r1_evidence_opt"]:checked');
    var evAnswer = evChecked ? evChecked.value : null;

    gameState = GameCore.submitRound1(gameState, currentCoursePack, {
      mappings: mappings,
      evidenceAnswer: evAnswer
    });

    var fbText = r1.evidence_check.feedback_reason[currentLang] || r1.evidence_check.feedback_reason.en;
    var fbEl = document.getElementById('r1-feedback');
    document.getElementById('r1-feedback-text').textContent = fbText;
    fbEl.style.display = 'flex';

    setTimeout(function () {
      showScreen('round2');
      renderRound2();
    }, 900);
  }

  // --- Round 2 Rendering ---
  function renderRound2() {
    updateProgressStep(2);
    var r2 = currentCoursePack.rounds.round2_access;
    document.getElementById('r2-title').textContent = r2.title[currentLang] || r2.title.en;
    document.getElementById('r2-scenario-prompt').textContent = r2.scenario_prompt[currentLang] || r2.scenario_prompt.en;

    // Instructor prompt
    if (r2.instructor_prompt) {
      document.getElementById('r2-instructor-prompt').textContent = r2.instructor_prompt[currentLang] || r2.instructor_prompt.en;
    }

    var container = document.getElementById('r2-decisions-container');
    container.innerHTML = r2.decisions.map(function (dec) {
      var title = dec.title[currentLang] || dec.title.en;
      var desc = dec.description[currentLang] || dec.description.en;
      return '<div class="choice-card" data-dec-id="' + dec.id + '">' +
        '<div class="choice-title">' + title + '</div>' +
        '<div class="choice-desc">' + desc + '</div>' +
        '</div>';
    }).join('');

    var cards = container.querySelectorAll('.choice-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        cards.forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        var decId = card.getAttribute('data-dec-id');
        evaluateRound2Decision(decId);
      });
    });

    document.getElementById('r2-safeguard-banner').style.display = 'none';
    document.getElementById('btn-submit-r2').disabled = true;
    updateInstructorClass();
  }

  function evaluateRound2Decision(decisionId) {
    gameState = GameCore.submitRound2(gameState, currentCoursePack, decisionId);
    var r2State = gameState.round2;
    var dec = currentCoursePack.rounds.round2_access.decisions.find(function (d) { return d.id === decisionId; });

    var banner = document.getElementById('r2-safeguard-banner');
    var icon = document.getElementById('r2-safeguard-icon');
    var title = document.getElementById('r2-safeguard-title');
    var desc = document.getElementById('r2-safeguard-desc');

    banner.style.display = 'flex';
    var reason = dec.feedback_reason[currentLang] || dec.feedback_reason.en;

    if (r2State.safeguardTriggered) {
      banner.className = 'safeguard-banner blocked';
      icon.textContent = '⛔';
      title.textContent = r2State.safeguardTriggered === 'scope_gate' ? I18N.get(currentLang, 'gateScopeTitle') : I18N.get(currentLang, 'gateHumanTitle');
      desc.textContent = reason;
    } else {
      banner.className = 'safeguard-banner success';
      icon.textContent = '✓';
      title.textContent = currentLang === 'th' ? 'การตัดสินใจได้รับอนุมัติ (Approved)' : 'Decision Approved';
      desc.textContent = reason;
    }

    document.getElementById('btn-submit-r2').disabled = false;
  }

  // --- Round 3 Rendering ---
  function renderRound3() {
    updateProgressStep(3);
    var r3 = currentCoursePack.rounds.round3_triage;
    document.getElementById('r3-title').textContent = r3.title[currentLang] || r3.title.en;
    document.getElementById('r3-incident-prompt').textContent = r3.incident_prompt[currentLang] || r3.incident_prompt.en;

    // Instructor prompt
    if (r3.instructor_prompt) {
      document.getElementById('r3-instructor-prompt').textContent = r3.instructor_prompt[currentLang] || r3.instructor_prompt.en;
    }

    document.getElementById('r3-limiter-banner').style.display = 'none';
    updateInstructorClass();
  }

  function submitRound3Action() {
    var likelihood = document.getElementById('r3-select-likelihood').value;
    var impact = document.getElementById('r3-select-impact').value;
    var confidence = document.getElementById('r3-select-confidence').value;

    gameState = GameCore.submitRound3(gameState, currentCoursePack, {
      likelihood: likelihood,
      impact: impact,
      confidence: confidence
    });

    var r3State = gameState.round3;
    var banner = document.getElementById('r3-limiter-banner');

    if (r3State.safeguardTriggered === 'evidence_limiter') {
      var r3Data = currentCoursePack.rounds.round3_triage.risk_dimensions;
      var reason = r3Data.limiter_rule.trigger_reason[currentLang] || r3Data.limiter_rule.trigger_reason.en;
      document.getElementById('r3-limiter-desc').textContent = reason;
      banner.style.display = 'flex';
      setTimeout(function () {
        showScreen('round4');
        renderRound4();
      }, 1500);
    } else {
      showScreen('round4');
      renderRound4();
    }
  }

  // --- Round 4 Rendering ---
  function renderRound4() {
    updateProgressStep(4);
    var r4 = currentCoursePack.rounds.round4_treat;
    document.getElementById('r4-title').textContent = r4.title[currentLang] || r4.title.en;

    // Instructor prompt
    if (r4.instructor_prompt) {
      document.getElementById('r4-instructor-prompt').textContent = r4.instructor_prompt[currentLang] || r4.instructor_prompt.en;
    }

    // Treatments
    var tContainer = document.getElementById('r4-treatments-container');
    tContainer.innerHTML = r4.treatment_options.map(function (t) {
      var name = t.name[currentLang] || t.name.en;
      return '<label class="choice-card" style="display: block; cursor: pointer;">' +
        '<input type="radio" name="r4_treatment" value="' + t.id + '"> ' +
        '<span>' + name + '</span>' +
        '</label>';
    }).join('');

    // Owners
    var oContainer = document.getElementById('r4-owners-container');
    oContainer.innerHTML = r4.accountable_owner_options.map(function (o) {
      var label = o.label[currentLang] || o.label.en;
      return '<label class="choice-card" style="display: block; cursor: pointer;">' +
        '<input type="radio" name="r4_owner" value="' + o.id + '"> ' +
        '<span>' + label + '</span>' +
        '</label>';
    }).join('');

    // Evidence
    var eContainer = document.getElementById('r4-evidence-container');
    eContainer.innerHTML = r4.verification_evidence_options.map(function (e) {
      var label = e.label[currentLang] || e.label.en;
      return '<label class="choice-card" style="display: block; cursor: pointer;">' +
        '<input type="radio" name="r4_evidence" value="' + e.id + '"> ' +
        '<span>' + label + '</span>' +
        '</label>';
    }).join('');

    document.getElementById('r4-residual-banner').style.display = 'none';
    updateInstructorClass();
  }

  function submitRound4Action() {
    var tChecked = document.querySelector('input[name="r4_treatment"]:checked');
    var oChecked = document.querySelector('input[name="r4_owner"]:checked');
    var eChecked = document.querySelector('input[name="r4_evidence"]:checked');

    if (!tChecked || !oChecked || !eChecked) {
      alert(currentLang === 'th' ? 'กรุณาเลือกมาตรการ ผู้รับผิดชอบ และหลักฐานให้ครบทุกข้อ' : 'Please select a treatment, owner, and verification evidence.');
      return;
    }

    gameState = GameCore.submitRound4(gameState, currentCoursePack, {
      treatmentId: tChecked.value,
      ownerId: oChecked.value,
      evidenceId: eChecked.value
    });

    var banner = document.getElementById('r4-residual-banner');
    banner.style.display = 'flex';
    document.getElementById('r4-residual-title').textContent = I18N.get(currentLang, 'residualRiskLabel') + ': ' + gameState.round4.residualRisk.level;
    document.getElementById('r4-residual-desc').textContent = gameState.round4.residualRisk.explanation;

    setTimeout(function () {
      showScreen('debrief');
      renderDebrief();
    }, 1200);
  }

  // --- Debrief Rendering ---
  function renderDebrief() {
    updateProgressStep(5);
    document.getElementById('debrief-title').textContent = I18N.get(currentLang, 'debriefTitle');
    var debriefData = currentCoursePack.debrief;
    var summary = debriefData.summary_template[currentLang] || debriefData.summary_template.en;
    document.getElementById('debrief-summary-text').textContent = summary;

    var lens = gameState.activeLens === 'shared' ? '305332' : gameState.activeLens;
    var scores = gameState.scoresByLens[lens];

    document.getElementById('lbl-score-scope').textContent = I18N.get(currentLang, 'scoreDimensionScope');
    document.getElementById('val-score-scope').textContent = scores.scope;

    document.getElementById('lbl-score-prop').textContent = I18N.get(currentLang, 'scoreDimensionProportionality');
    document.getElementById('val-score-prop').textContent = scores.proportionality;

    document.getElementById('lbl-score-ev').textContent = I18N.get(currentLang, 'scoreDimensionEvidence');
    document.getElementById('val-score-ev').textContent = scores.evidence;

    document.getElementById('lbl-score-acc').textContent = I18N.get(currentLang, 'scoreDimensionAccountability');
    document.getElementById('val-score-acc').textContent = scores.accountability;

    // Misconceptions
    var miscContainer = document.getElementById('debrief-misconceptions');
    miscContainer.innerHTML = debriefData.key_misconceptions.map(function (m) {
      var concept = m.concept[currentLang] || m.concept.en;
      var expl = m.explanation[currentLang] || m.explanation.en;
      return '<li style="margin-bottom: 0.85rem;"><strong>' + concept + ':</strong> ' + expl + '</li>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
