/**
 * i18n.js
 * Bilingual Thai and English dictionary for Data & Access Risk Triage.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.I18N = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var translations = {
    en: {
      appName: 'Data & Access Risk Triage',
      appSubtitle: 'Interactive Practice for 305332 & 316332 Cybersecurity',
      institution: 'Naresuan University · Department of Electrical and Computer Engineering',
      backToPortal: '← Back to Activities Portal',
      btnProjectorMode: '📽️ Projector View',
      btnInstructorMode: '🎓 Instructor Guide',
      instructorCalloutTitle: '🎓 Instructor Facilitation: Ask the Room',
      timerTitle: 'Classroom Deliberation Timer',
      timer1Min: '1 min',
      timer2Min: '2 min',
      timerPause: 'Pause',
      timerReset: 'Reset',
      ticketTitle: 'System Change Request & Architecture Context',
      architectureDiagramTitle: 'Visual Data Flow & System Architecture',
      lensSelectorTitle: 'Select Your Course Lens',
      lensSelectorSubtitle: 'The core scenario is shared, but each course evaluates a distinct learning dimension. Scores are tracked separately and never combined.',
      lens305332Title: '305332 Lens: Identity & Access',
      lens305332Desc: 'Focus on least privilege, scoped RBAC, authentication dependencies, and account lifecycle deprovisioning.',
      lens316332Title: '316332 Lens: Privacy & Governance',
      lens316332Desc: 'Focus on personal data sensitivity, data minimisation, likelihood/impact triage, and governance controls.',
      lensSharedTitle: 'Shared Practice Mode',
      lensSharedDesc: 'Experience both identity and privacy viewpoints in sequence. Generates independent debriefs for each course.',
      roundNav: 'Round',
      roundOf: 'of 4',
      round1Title: 'Map What is at Stake',
      round2Title: 'Decide Scoped Access',
      round3Title: 'Triage Risk & Evidence',
      round4Title: 'Treat & Govern',
      debriefTitle: 'Activity Debrief & Evidence Summary',
      btnNext: 'Next Round →',
      btnSubmit: 'Confirm & Evaluate Decision',
      btnRestart: 'Restart Activity',
      btnGlossary: 'Open Glossary',
      btnClose: 'Close',
      glossaryTitle: 'Key Concepts & Glossary',
      scoreDimensionScope: 'Scope',
      scoreDimensionProportionality: 'Proportionality',
      scoreDimensionEvidence: 'Evidence',
      scoreDimensionAccountability: 'Accountability',
      gateTriggered: 'Safeguard Activated',
      gateScopeTitle: 'Scope Gate Rejection',
      gateLimiterTitle: 'Evidence Limiter Gate Rejection',
      gateHumanTitle: 'Human-Approval Gate Rejection',
      residualRiskLabel: 'Residual Risk Level',
      residualRiskWarning: 'Controls reduce risk, but residual risk is never zero.',
      disclaimerNotice: 'Synthetic case study only. Formative educational practice — no real data or compliance assertions.',
      glossary: [
        { term: 'Least Privilege', def: 'Granting an identity only the minimum set of permissions necessary to perform its approved function for the required duration.' },
        { term: 'Deprovisioning', def: 'The timely removal or disabling of access rights and credentials when an event concludes or an employee leaves.' },
        { term: 'Service Identity (Non-Person Entity)', def: 'An account or token used by an automated script or background service. Must never possess unreviewed administrative elevation powers.' },
        { term: 'Data Minimisation', def: 'Limiting data collection and export strictly to what is directly necessary to accomplish the specified purpose.' },
        { term: 'Residual Risk', def: 'The risk that remains after security controls and treatments are applied. It must be acknowledged, monitored, and accepted.' },
        { term: 'Data Processing Agreement (DPA)', def: 'A legally binding contract defining how a third-party vendor processes and protects shared data.' }
      ]
    },
    th: {
      appName: 'Data & Access Risk Triage',
      appSubtitle: 'กิจกรรมฝึกปฏิบัติเชิงโต้ตอบสำหรับ Cybersecurity 305332 และ 316332',
      institution: 'มหาวิทยาลัยนเรศวร · ภาควิชาวิศวกรรมไฟฟ้าและคอมพิวเตอร์',
      backToPortal: '← กลับสู่หน้าหลัก Activities Portal',
      btnProjectorMode: '📽️ โหมด Projector',
      btnInstructorMode: '🎓 คู่มือผู้สอน',
      instructorCalloutTitle: '🎓 ผู้สอนชวนคิด: คำถามเปิดประเด็นในห้องเรียน',
      timerTitle: 'จับเวลาอภิปรายในชั้นเรียน (Think-Pair-Share)',
      timer1Min: '1 นาที',
      timer2Min: '2 นาที',
      timerPause: 'หยุดชั่วคราว',
      timerReset: 'รีเซ็ต',
      ticketTitle: 'บริบททางสถาปัตยกรรมและใบคำขอการเปลี่ยนแปลงระบบ',
      architectureDiagramTitle: 'แผนผังสถาปัตยกรรมระบบและการไหลของข้อมูล',
      lensSelectorTitle: 'เลือกมุมมองรายวิชา (Course Lens)',
      lensSelectorSubtitle: 'สถานการณ์หลักใช้ร่วมกัน แต่แต่ละวิชาจะประเมินมิติการเรียนรู้ที่แตกต่างกัน คะแนนจะถูกบันทึกแยกจากกันอย่างชัดเจน',
      lens305332Title: 'มุมมอง 305332: การจัดการตัวตนและการเข้าถึง',
      lens305332Desc: 'เน้นหลักสิทธิขั้นต่ำ (Least Privilege), RBAC ตามขอบเขต, การยืนยันตัวตน และการเพิกถอนบัญชีตามวงจรชีวิต',
      lens316332Title: 'มุมมอง 316332: ความเป็นส่วนตัวและธรรมาภิบาล',
      lens316332Desc: 'เน้นความอ่อนไหวของข้อมูลส่วนบุคคล, การลดทอนข้อมูล (Data Minimisation), การจัดลำดับความเสี่ยง และธรรมาภิบาล',
      lensSharedTitle: 'โหมดฝึกปฏิบัติร่วม (Shared Practice)',
      lensSharedDesc: 'เรียนรู้ทั้งสองมุมมองควบคู่กัน โดยระบบจะแยกสรุปผลการเรียนรู้ของแต่ละรายวิชาออกจากกัน',
      roundNav: 'รอบที่',
      roundOf: 'จาก 4',
      round1Title: 'ระบุข้อมูลและผู้เกี่ยวข้อง',
      round2Title: 'ตัดสินใจกำหนดสิทธิ์การเข้าถึง',
      round3Title: 'ประเมินและจัดลำดับความเสี่ยง',
      round4Title: 'กำหนดมาตรการและธรรมาภิบาล',
      debriefTitle: 'สรุปผลการเรียนรู้และหลักฐานการตัดสินใจ',
      btnNext: 'ไปยังรอบถัดไป →',
      btnSubmit: 'ยืนยันและประเมินผลการตัดสินใจ',
      btnRestart: 'เริ่มกิจกรรมใหม่',
      btnGlossary: 'เปิดดูอภิธานศัพท์',
      btnClose: 'ปิด',
      glossaryTitle: 'อภิธานศัพท์และแนวคิดสำคัญ',
      scoreDimensionScope: 'ขอบเขต (Scope)',
      scoreDimensionProportionality: 'ความได้สัดส่วน (Proportionality)',
      scoreDimensionEvidence: 'หลักฐานอ้างอิง (Evidence)',
      scoreDimensionAccountability: 'ความรับผิดชอบ (Accountability)',
      gateTriggered: 'ระบบความปลอดภัยทำงาน (Safeguard Activated)',
      gateScopeTitle: 'การปฏิเสธโดย Scope Gate',
      gateLimiterTitle: 'การปฏิเสธโดย Evidence Limiter Gate',
      gateHumanTitle: 'การปฏิเสธโดย Human-Approval Gate',
      residualRiskLabel: 'ระดับความเสี่ยงตกค้าง (Residual Risk)',
      residualRiskWarning: 'มาตรการควบคุมช่วยลดความเสี่ยง แต่ความเสี่ยงตกค้างไม่มีวันเป็นศูนย์',
      disclaimerNotice: 'กรณีศึกษาจำลองเพื่อการศึกษาเท่านั้น ไม่มีการเก็บข้อมูลจริงและไม่ถือเป็นข้อสรุปทางกฎหมาย',
      glossary: [
        { term: 'Least Privilege (สิทธิขั้นต่ำ)', def: 'การกำหนดสิทธิ์ให้ผู้ใช้หรือระบบมีเฉพาะสิทธิ์ที่จำเป็นจริงในการทำงานตามเวลาที่กำหนดเท่านั้น' },
        { term: 'Deprovisioning (การเพิกถอนสิทธิ์)', def: 'กระบวนการปิดการใช้งานหรือถอดถอนสิทธิ์ของผู้ใช้ทันทีที่เสร็จสิ้นภารกิจหรือพ้นสภาพ' },
        { term: 'Service Identity (ตัวตนระบบ/เวิร์กโหลด)', def: 'บัญชีหรือ Token สำหรับโปรแกรมทำงานเบื้องหลัง ต้องไม่มีสิทธิ์ปรับแก้ Role หรืออนุมัติสิทธิ์แทนมนุษย์' },
        { term: 'Data Minimisation (การลดทอนข้อมูล)', def: 'การจำกัดการเก็บ รวบรวม หรือส่งออกข้อมูลให้เหลือเพียงเท่าที่จำเป็นอย่างแท้จริง' },
        { term: 'Residual Risk (ความเสี่ยงตกค้าง)', def: 'ความเสี่ยงที่ยังคงหลงเหลืออยู่หลังดำเนินมาตรการควบคุมความปลอดภัยแล้ว ซึ่งต้องยอมรับและเฝ้าระวัง' },
        { term: 'Data Processing Agreement (สัญญา DPA)', def: 'ข้อตกลงทางกฎหมายที่ระบุขอบเขตและหน้าที่ของผู้ให้บริการภายนอกในการคุ้มครองข้อมูล' }
      ]
    }
  };

  return {
    get: function (lang, key) {
      var l = lang === 'th' ? 'th' : 'en';
      return (translations[l] && translations[l][key]) || translations.en[key] || key;
    },
    getTranslations: function (lang) {
      return translations[lang === 'th' ? 'th' : 'en'] || translations.en;
    }
  };
});
