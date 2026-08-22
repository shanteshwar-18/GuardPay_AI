/**
 * GuardPay AI — Screen-level translations (EN / HI / MR / TA)
 *
 * Product spec §26: "Do NOT scatter text strings throughout components. Use i18n /
 * translation dictionaries. All user-facing warnings, risk explanations and security
 * messages must be translatable."
 *
 * Kept separate from translations.ts (which holds the original risk-message keys) so
 * the two can evolve independently; i18n/index.ts deep-merges both into one resource
 * bundle per language. Every namespace below MUST exist in all four languages —
 * a missing key silently falls back to English, which for a security warning means
 * a Tamil-speaking user reads an untranslated threat message.
 */

export const screenTranslations = {
  en: {
    nav: { home: 'Home', activity: 'Activity', protection: 'Protection', contacts: 'Contacts', settings: 'Settings' },

    splash: { tagline: "Smart. Secure. You're in Control.", subtitle: 'Real-time protection for every UPI payment.' },

    onboarding: {
      skip: 'Skip', next: 'Next', getStarted: 'Get Started',
      s1Title: 'AI-Powered Payment Protection',
      s1Body: 'We analyze payment context, calls, messages and device signals in real time to help keep you safe from scams.',
      s2Title: 'We Check Before You Pay',
      s2Body: 'GuardPay reviews the situation around your payment before it is authorized — not after your money has gone.',
      s3Title: 'Protection That Fits the Risk',
      s3Body: 'Low risk goes straight through. Higher risk gets a warning, a hold, or is blocked and verified with someone you trust.',
    },

    permissions: {
      title: 'Allow Required Permissions',
      subtitle: 'GuardPay uses these permissions only during an active protected payment session.',
      micName: 'Microphone', micDesc: 'To analyze permitted call and audio context',
      screenName: 'Screen Capture', screenDesc: 'To analyze screen context during an active protection session',
      notifName: 'Notifications', notifDesc: 'To show real-time risk and security alerts',
      phoneName: 'Phone / Call State', phoneDesc: 'To understand active call context where supported',
      allow: 'Allow', granted: 'Granted', denied: 'Denied', notRequested: 'Not set',
      simulated: 'Demo signal', continue: 'Continue',
      simulatedNote: 'Marked signals are simulated for this prototype and do not read your device.',
      screenCaptureNote: 'GuardPay only asks for this permission — it does not record, view or transmit your screen in this build.',
    },

    dashboard: {
      protected: "You're Protected",
      protectedSub: 'GuardPay Protection is active for your payment sessions.',
      inactive: 'Protection Paused',
      inactiveSub: 'Turn Active Protection back on in Settings.',
      summaryTitle: 'Protection Summary',
      protectedCount: 'Payments Protected', alertsCount: 'Alerts', holdsCount: 'Interventions',
      recentActivity: 'Recent Activity', viewAll: 'View all', sendMoney: 'Send Money',
      seniorMode: 'Senior Citizen Mode',
      seniorModeHint: 'Larger text, simpler wording and colour-only risk meters',
      language: 'Language', noActivity: 'No payments yet',
      noActivityBody: 'Your protected payments will appear here.',
    },

    payment: {
      title: 'Make a Payment', upiLabel: 'Enter UPI ID / Number', upiPlaceholder: 'name@bank',
      amountLabel: 'Enter Amount', noteLabel: 'Add Note (Optional)', notePlaceholder: 'What is this for?',
      proceed: 'Proceed to Pay', recentBeneficiaries: 'Recent Beneficiaries',
      newPayee: 'NEW', trusted: 'Trusted', invalidUpi: 'Enter a valid UPI ID',
      invalidAmount: 'Enter an amount greater than zero',
    },

    session: {
      active: 'GuardPay Protection Active',
      checking: 'Checking this payment for suspicious activity before authorization.',
      evaluating: 'Analyzing payment context…', complete: 'Check complete',
      unavailable: 'Unable to complete security check',
      unavailableBody: 'We could not finish the safety check, so we are asking you to verify before continuing.',
    },

    risk: {
      scoreLabel: 'Risk Score', outOf: '/ 100', whatWeChecked: 'What We Checked',
      whyFlagged: 'Why we flagged this payment', technicalDetails: 'Technical details',
      common: { cancel: 'Cancel Payment', back: 'Back' },
      badge: { safe: 'Safe', warning: 'Warning', hold: 'Held', intercept: 'Blocked' },
      safe: {
        title: 'Everything Looks Safe',
        description: 'No significant suspicious activity was detected. You can proceed with this payment.',
        seniorTitle: 'This payment looks safe',
        seniorDescription: 'We did not find anything unusual. You can continue.',
        primaryCta: 'Proceed to Pay',
      },
      warning: {
        title: 'We Detected Something Unusual',
        description: 'We recommend that you verify this payment before proceeding.',
        seniorTitle: 'Please check before you pay',
        seniorDescription: 'Something about this payment is unusual. Please verify it first.',
        primaryCta: 'Verify & Continue',
      },
      hold: {
        title: 'High Risk Detected',
        description: 'We are holding this payment temporarily for your safety.',
        seniorTitle: 'STOP — this payment is on hold',
        seniorDescription: 'This payment may be dangerous. We have paused it to keep your money safe.',
        primaryCta: 'Verify with Trusted Contact',
      },
      intercept: {
        title: 'Critical Risk — Payment Blocked',
        description: 'This looks like a scam. We have blocked this payment to protect you.',
        seniorTitle: 'STOP — we blocked this payment',
        seniorDescription: 'This looks like a scam. We stopped it to protect your money.',
        primaryCta: 'Contact Trusted Person',
        advice: 'Do not continue the conversation or share your PIN/OTP.',
      },
      factor: {
        audio: 'Voice Analysis', text: 'Message Analysis', ocr: 'Screen Check',
        behaviour: 'Behaviour Analysis', beneficiary: 'Beneficiary Check', device: 'Device Behaviour',
      },
      severity: {
        normal: 'Normal', unusual: 'Unusual', suspicious: 'Suspicious', critical: 'High Risk',
        newBeneficiary: 'New Beneficiary',
      },
      evidenceSaved: 'Security evidence preserved',
      alertSent: 'Your payment protection alert has been sent securely.',
    },

    trustedContact: {
      title: 'Verify with Trusted Contact',
      calling: 'Calling…', connected: 'Connected', waiting: 'Waiting for confirmation…',
      body: 'We are calling your trusted contact to independently verify this payment.',
      endCall: 'End Call', enterCode: 'Enter Code Manually',
      noContact: 'No trusted contact set',
      noContactBody: 'Add a trusted contact in Settings to use this verification step.',
      simulatedNote: 'Trusted-contact call is simulated in this demo build.',
    },

    verification: {
      title: 'Enter Verification Code',
      body: 'Ask your trusted contact to enter or tell you the verification code shown to them.',
      verify: 'Verify Code', resendIn: 'Resend code in {{seconds}}s', resend: 'Resend Code',
      invalid: 'That code is not correct. Please try again.',
      attemptsLeft: '{{count}} attempts remaining',
      expired: 'This code has expired. Request a new one.',
      success: 'Verified', failed: 'Verification failed',
      frozenBody: 'Too many incorrect attempts. This payment has been frozen for your safety.',
    },

    pin: {
      title: 'Enter UPI PIN', subtitle: 'Simulated authorization — do not enter a real UPI PIN.',
      payingTo: 'Paying to', securityNote: 'Protected by GuardPay', cancel: 'Cancel',
    },

    success: {
      title: 'Payment Successful!', paidTo: 'Paid to', txnId: 'UPI Transaction ID',
      viewDetails: 'View Details', backHome: 'Back to Home',
    },

    activity: {
      title: 'Activity',
      all: 'All', safe: 'Safe', warning: 'Warning', held: 'Held', blocked: 'Blocked',
      empty: 'Nothing here yet', emptyBody: 'Payments you make will show up here with their safety result.',
      detailTitle: 'Transaction Details', decision: 'Decision', verification: 'Verification',
      evidence: 'Evidence', amount: 'Amount', beneficiary: 'Beneficiary', time: 'Time',
      verified: 'Verified', notVerified: 'Not required', preserved: 'Preserved',
    },

    settings: {
      title: 'Settings', protection: 'Protection', about: 'About',
      activeProtection: 'Active Protection', seniorMode: 'Senior Citizen Mode',
      trustedContacts: 'Trusted Contacts', language: 'Language', voiceAlerts: 'Voice Alerts',
      notifications: 'Notifications', privacy: 'Privacy', aboutApp: 'About GuardPay AI',
      help: 'Help & Support', logout: 'Logout', on: 'On', off: 'Off',
      contactsCount: '{{count}} contacts', addContact: 'Add Contact', removeContact: 'Remove',
      contactName: 'Name', contactPhone: 'Phone Number', contactRelation: 'Relationship',
      save: 'Save', demoMode: 'Demo Mode', demoModeHint: 'Force a scenario for demonstration',
    },

    common: { retry: 'Retry', close: 'Close', cancel: 'Cancel', confirm: 'Confirm', loading: 'Loading…' },
  },

  hi: {
    nav: { home: 'होम', activity: 'गतिविधि', protection: 'सुरक्षा', contacts: 'संपर्क', settings: 'सेटिंग्स' },

    splash: { tagline: 'स्मार्ट. सुरक्षित. नियंत्रण आपके पास.', subtitle: 'हर UPI भुगतान के लिए रीयल-टाइम सुरक्षा.' },

    onboarding: {
      skip: 'छोड़ें', next: 'आगे', getStarted: 'शुरू करें',
      s1Title: 'AI-आधारित भुगतान सुरक्षा',
      s1Body: 'हम भुगतान की परिस्थिति, कॉल, संदेश और डिवाइस संकेतों का रीयल-टाइम विश्लेषण करते हैं ताकि आप धोखाधड़ी से सुरक्षित रहें.',
      s2Title: 'भुगतान से पहले जाँच',
      s2Body: 'GuardPay आपके भुगतान की मंज़ूरी से पहले परिस्थिति जाँचता है — पैसे जाने के बाद नहीं.',
      s3Title: 'जोखिम के अनुसार सुरक्षा',
      s3Body: 'कम जोखिम सीधे आगे बढ़ता है. अधिक जोखिम पर चेतावनी, रोक, या भरोसेमंद व्यक्ति से पुष्टि की जाती है.',
    },

    permissions: {
      title: 'आवश्यक अनुमतियाँ दें',
      subtitle: 'GuardPay इन अनुमतियों का उपयोग केवल सक्रिय सुरक्षित भुगतान सत्र के दौरान करता है.',
      micName: 'माइक्रोफ़ोन', micDesc: 'अनुमति प्राप्त कॉल और ऑडियो संदर्भ का विश्लेषण करने के लिए',
      screenName: 'स्क्रीन कैप्चर', screenDesc: 'सक्रिय सुरक्षा सत्र के दौरान स्क्रीन संदर्भ जाँचने के लिए',
      notifName: 'सूचनाएँ', notifDesc: 'रीयल-टाइम जोखिम और सुरक्षा अलर्ट दिखाने के लिए',
      phoneName: 'फ़ोन / कॉल स्थिति', phoneDesc: 'सक्रिय कॉल की स्थिति समझने के लिए',
      allow: 'अनुमति दें', granted: 'दी गई', denied: 'अस्वीकृत', notRequested: 'सेट नहीं',
      simulated: 'डेमो संकेत', continue: 'जारी रखें',
      simulatedNote: 'चिह्नित संकेत इस प्रोटोटाइप में नकली हैं और आपका डिवाइस नहीं पढ़ते.',
      screenCaptureNote: 'GuardPay केवल यह अनुमति माँगता है — यह इस बिल्ड में आपकी स्क्रीन को रिकॉर्ड, देखता या भेजता नहीं है.',
    },

    dashboard: {
      protected: 'आप सुरक्षित हैं',
      protectedSub: 'आपके भुगतान सत्रों के लिए GuardPay सुरक्षा सक्रिय है.',
      inactive: 'सुरक्षा रुकी हुई है', inactiveSub: 'सेटिंग्स में सक्रिय सुरक्षा फिर से चालू करें.',
      summaryTitle: 'सुरक्षा सारांश',
      protectedCount: 'सुरक्षित भुगतान', alertsCount: 'अलर्ट', holdsCount: 'हस्तक्षेप',
      recentActivity: 'हाल की गतिविधि', viewAll: 'सभी देखें', sendMoney: 'पैसे भेजें',
      seniorMode: 'वरिष्ठ नागरिक मोड',
      seniorModeHint: 'बड़ा टेक्स्ट, सरल शब्द और केवल-रंग जोखिम मीटर',
      language: 'भाषा', noActivity: 'अभी कोई भुगतान नहीं',
      noActivityBody: 'आपके सुरक्षित भुगतान यहाँ दिखेंगे.',
    },

    payment: {
      title: 'भुगतान करें', upiLabel: 'UPI ID / नंबर दर्ज करें', upiPlaceholder: 'name@bank',
      amountLabel: 'राशि दर्ज करें', noteLabel: 'नोट जोड़ें (वैकल्पिक)', notePlaceholder: 'यह किसलिए है?',
      proceed: 'भुगतान करें', recentBeneficiaries: 'हाल के लाभार्थी',
      newPayee: 'नया', trusted: 'भरोसेमंद', invalidUpi: 'मान्य UPI ID दर्ज करें',
      invalidAmount: 'शून्य से अधिक राशि दर्ज करें',
    },

    session: {
      active: 'GuardPay सुरक्षा सक्रिय',
      checking: 'मंज़ूरी से पहले इस भुगतान की संदिग्ध गतिविधि जाँची जा रही है.',
      evaluating: 'भुगतान संदर्भ का विश्लेषण…', complete: 'जाँच पूरी',
      unavailable: 'सुरक्षा जाँच पूरी नहीं हो सकी',
      unavailableBody: 'हम सुरक्षा जाँच पूरी नहीं कर सके, इसलिए आगे बढ़ने से पहले पुष्टि करें.',
    },

    risk: {
      scoreLabel: 'जोखिम स्कोर', outOf: '/ 100', whatWeChecked: 'हमने क्या जाँचा',
      whyFlagged: 'हमने इस भुगतान को क्यों चिह्नित किया', technicalDetails: 'तकनीकी विवरण',
      common: { cancel: 'भुगतान रद्द करें', back: 'वापस' },
      badge: { safe: 'सुरक्षित', warning: 'चेतावनी', hold: 'रोका गया', intercept: 'अवरुद्ध' },
      safe: {
        title: 'सब कुछ सुरक्षित लगता है',
        description: 'कोई महत्वपूर्ण संदिग्ध गतिविधि नहीं मिली. आप यह भुगतान कर सकते हैं.',
        seniorTitle: 'यह भुगतान सुरक्षित लगता है',
        seniorDescription: 'हमें कुछ भी असामान्य नहीं मिला. आप आगे बढ़ सकते हैं.',
        primaryCta: 'भुगतान करें',
      },
      warning: {
        title: 'हमें कुछ असामान्य मिला',
        description: 'आगे बढ़ने से पहले इस भुगतान की पुष्टि करने की सलाह दी जाती है.',
        seniorTitle: 'भुगतान से पहले जाँच करें',
        seniorDescription: 'इस भुगतान में कुछ असामान्य है. पहले इसकी पुष्टि करें.',
        primaryCta: 'पुष्टि करें और जारी रखें',
      },
      hold: {
        title: 'उच्च जोखिम मिला',
        description: 'आपकी सुरक्षा के लिए हम यह भुगतान अस्थायी रूप से रोक रहे हैं.',
        seniorTitle: 'रुकें — यह भुगतान रोका गया है',
        seniorDescription: 'यह भुगतान ख़तरनाक हो सकता है. आपके पैसे बचाने के लिए हमने इसे रोका है.',
        primaryCta: 'भरोसेमंद संपर्क से पुष्टि करें',
      },
      intercept: {
        title: 'गंभीर जोखिम — भुगतान अवरुद्ध',
        description: 'यह धोखाधड़ी लगती है. आपकी सुरक्षा के लिए हमने यह भुगतान रोक दिया है.',
        seniorTitle: 'रुकें — हमने यह भुगतान रोक दिया',
        seniorDescription: 'यह धोखाधड़ी लगती है. आपके पैसे बचाने के लिए हमने इसे रोक दिया.',
        primaryCta: 'भरोसेमंद व्यक्ति से संपर्क करें',
        advice: 'बातचीत जारी न रखें और अपना PIN/OTP साझा न करें.',
      },
      factor: {
        audio: 'आवाज़ विश्लेषण', text: 'संदेश विश्लेषण', ocr: 'स्क्रीन जाँच',
        behaviour: 'व्यवहार विश्लेषण', beneficiary: 'लाभार्थी जाँच', device: 'डिवाइस व्यवहार',
      },
      severity: {
        normal: 'सामान्य', unusual: 'असामान्य', suspicious: 'संदिग्ध', critical: 'उच्च जोखिम',
        newBeneficiary: 'नया लाभार्थी',
      },
      evidenceSaved: 'सुरक्षा साक्ष्य सुरक्षित रखा गया',
      alertSent: 'आपका भुगतान सुरक्षा अलर्ट सुरक्षित रूप से भेजा गया है.',
    },

    trustedContact: {
      title: 'भरोसेमंद संपर्क से पुष्टि करें',
      calling: 'कॉल हो रही है…', connected: 'जुड़ गया', waiting: 'पुष्टि की प्रतीक्षा…',
      body: 'इस भुगतान की स्वतंत्र पुष्टि के लिए हम आपके भरोसेमंद संपर्क को कॉल कर रहे हैं.',
      endCall: 'कॉल समाप्त करें', enterCode: 'कोड मैन्युअल रूप से दर्ज करें',
      noContact: 'कोई भरोसेमंद संपर्क सेट नहीं',
      noContactBody: 'इस पुष्टि चरण के लिए सेटिंग्स में भरोसेमंद संपर्क जोड़ें.',
      simulatedNote: 'इस डेमो बिल्ड में भरोसेमंद-संपर्क कॉल नकली है.',
    },

    verification: {
      title: 'सत्यापन कोड दर्ज करें',
      body: 'अपने भरोसेमंद संपर्क से उन्हें दिखाया गया सत्यापन कोड पूछें.',
      verify: 'कोड सत्यापित करें', resendIn: '{{seconds}} सेकंड में दोबारा भेजें', resend: 'कोड दोबारा भेजें',
      invalid: 'यह कोड सही नहीं है. कृपया फिर कोशिश करें.',
      attemptsLeft: '{{count}} प्रयास शेष',
      expired: 'यह कोड समाप्त हो गया है. नया कोड माँगें.',
      success: 'सत्यापित', failed: 'सत्यापन विफल',
      frozenBody: 'बहुत बार ग़लत प्रयास. आपकी सुरक्षा के लिए यह भुगतान रोक दिया गया है.',
    },

    pin: {
      title: 'UPI PIN दर्ज करें', subtitle: 'नकली प्राधिकरण — असली UPI PIN दर्ज न करें.',
      payingTo: 'भुगतान प्राप्तकर्ता', securityNote: 'GuardPay द्वारा सुरक्षित', cancel: 'रद्द करें',
    },

    success: {
      title: 'भुगतान सफल!', paidTo: 'भुगतान किया', txnId: 'UPI लेनदेन ID',
      viewDetails: 'विवरण देखें', backHome: 'होम पर वापस',
    },

    activity: {
      title: 'गतिविधि',
      all: 'सभी', safe: 'सुरक्षित', warning: 'चेतावनी', held: 'रोका गया', blocked: 'अवरुद्ध',
      empty: 'अभी कुछ नहीं', emptyBody: 'आपके भुगतान उनके सुरक्षा परिणाम के साथ यहाँ दिखेंगे.',
      detailTitle: 'लेनदेन विवरण', decision: 'निर्णय', verification: 'सत्यापन',
      evidence: 'साक्ष्य', amount: 'राशि', beneficiary: 'लाभार्थी', time: 'समय',
      verified: 'सत्यापित', notVerified: 'आवश्यक नहीं', preserved: 'सुरक्षित',
    },

    settings: {
      title: 'सेटिंग्स', protection: 'सुरक्षा', about: 'परिचय',
      activeProtection: 'सक्रिय सुरक्षा', seniorMode: 'वरिष्ठ नागरिक मोड',
      trustedContacts: 'भरोसेमंद संपर्क', language: 'भाषा', voiceAlerts: 'ध्वनि अलर्ट',
      notifications: 'सूचनाएँ', privacy: 'गोपनीयता', aboutApp: 'GuardPay AI के बारे में',
      help: 'सहायता', logout: 'लॉग आउट', on: 'चालू', off: 'बंद',
      contactsCount: '{{count}} संपर्क', addContact: 'संपर्क जोड़ें', removeContact: 'हटाएँ',
      contactName: 'नाम', contactPhone: 'फ़ोन नंबर', contactRelation: 'रिश्ता',
      save: 'सहेजें', demoMode: 'डेमो मोड', demoModeHint: 'प्रदर्शन के लिए परिदृश्य चुनें',
    },

    common: { retry: 'फिर कोशिश करें', close: 'बंद करें', cancel: 'रद्द करें', confirm: 'पुष्टि करें', loading: 'लोड हो रहा है…' },
  },

  mr: {
    nav: { home: 'होम', activity: 'क्रियाकलाप', protection: 'संरक्षण', contacts: 'संपर्क', settings: 'सेटिंग्ज' },

    splash: { tagline: 'स्मार्ट. सुरक्षित. नियंत्रण तुमच्याकडे.', subtitle: 'प्रत्येक UPI पेमेंटसाठी रिअल-टाइम संरक्षण.' },

    onboarding: {
      skip: 'वगळा', next: 'पुढे', getStarted: 'सुरू करा',
      s1Title: 'AI-आधारित पेमेंट संरक्षण',
      s1Body: 'फसवणुकीपासून सुरक्षित ठेवण्यासाठी आम्ही पेमेंटचा संदर्भ, कॉल, संदेश आणि डिव्हाइस संकेत रिअल-टाइम तपासतो.',
      s2Title: 'पैसे देण्यापूर्वी तपासणी',
      s2Body: 'GuardPay तुमच्या पेमेंटला मंजुरी मिळण्यापूर्वी परिस्थिती तपासतो — पैसे गेल्यानंतर नाही.',
      s3Title: 'धोक्यानुसार संरक्षण',
      s3Body: 'कमी धोका थेट पुढे जातो. जास्त धोक्यावर इशारा, थांबा, किंवा विश्वासू व्यक्तीकडून खात्री केली जाते.',
    },

    permissions: {
      title: 'आवश्यक परवानग्या द्या',
      subtitle: 'GuardPay या परवानग्या फक्त सक्रिय संरक्षित पेमेंट सत्रादरम्यान वापरतो.',
      micName: 'मायक्रोफोन', micDesc: 'परवानगी असलेल्या कॉल आणि ऑडिओ संदर्भाचे विश्लेषण करण्यासाठी',
      screenName: 'स्क्रीन कॅप्चर', screenDesc: 'सक्रिय संरक्षण सत्रादरम्यान स्क्रीन संदर्भ तपासण्यासाठी',
      notifName: 'सूचना', notifDesc: 'रिअल-टाइम धोका आणि सुरक्षा सूचना दाखवण्यासाठी',
      phoneName: 'फोन / कॉल स्थिती', phoneDesc: 'सक्रिय कॉलची स्थिती समजून घेण्यासाठी',
      allow: 'परवानगी द्या', granted: 'दिली', denied: 'नाकारली', notRequested: 'सेट नाही',
      simulated: 'डेमो संकेत', continue: 'सुरू ठेवा',
      simulatedNote: 'चिन्हांकित संकेत या प्रोटोटाइपमध्ये बनावट आहेत आणि तुमचे डिव्हाइस वाचत नाहीत.',
      screenCaptureNote: 'GuardPay फक्त ही परवानगी विचारते — या बिल्डमध्ये ते तुमची स्क्रीन रेकॉर्ड, पाहत किंवा पाठवत नाही.',
    },

    dashboard: {
      protected: 'तुम्ही सुरक्षित आहात',
      protectedSub: 'तुमच्या पेमेंट सत्रांसाठी GuardPay संरक्षण सक्रिय आहे.',
      inactive: 'संरक्षण थांबवले आहे', inactiveSub: 'सेटिंग्जमध्ये सक्रिय संरक्षण पुन्हा चालू करा.',
      summaryTitle: 'संरक्षण सारांश',
      protectedCount: 'संरक्षित पेमेंट', alertsCount: 'सूचना', holdsCount: 'हस्तक्षेप',
      recentActivity: 'अलीकडील क्रियाकलाप', viewAll: 'सर्व पहा', sendMoney: 'पैसे पाठवा',
      seniorMode: 'ज्येष्ठ नागरिक मोड',
      seniorModeHint: 'मोठा मजकूर, सोपे शब्द आणि फक्त-रंग धोका मीटर',
      language: 'भाषा', noActivity: 'अद्याप कोणतेही पेमेंट नाही',
      noActivityBody: 'तुमची संरक्षित पेमेंट येथे दिसतील.',
    },

    payment: {
      title: 'पेमेंट करा', upiLabel: 'UPI ID / नंबर टाका', upiPlaceholder: 'name@bank',
      amountLabel: 'रक्कम टाका', noteLabel: 'टीप जोडा (ऐच्छिक)', notePlaceholder: 'हे कशासाठी आहे?',
      proceed: 'पेमेंट करा', recentBeneficiaries: 'अलीकडील लाभार्थी',
      newPayee: 'नवीन', trusted: 'विश्वासू', invalidUpi: 'वैध UPI ID टाका',
      invalidAmount: 'शून्यापेक्षा जास्त रक्कम टाका',
    },

    session: {
      active: 'GuardPay संरक्षण सक्रिय',
      checking: 'मंजुरीपूर्वी या पेमेंटची संशयास्पद हालचाल तपासली जात आहे.',
      evaluating: 'पेमेंट संदर्भाचे विश्लेषण…', complete: 'तपासणी पूर्ण',
      unavailable: 'सुरक्षा तपासणी पूर्ण होऊ शकली नाही',
      unavailableBody: 'आम्ही सुरक्षा तपासणी पूर्ण करू शकलो नाही, त्यामुळे पुढे जाण्यापूर्वी खात्री करा.',
    },

    risk: {
      scoreLabel: 'धोका स्कोअर', outOf: '/ 100', whatWeChecked: 'आम्ही काय तपासले',
      whyFlagged: 'आम्ही हे पेमेंट का चिन्हांकित केले', technicalDetails: 'तांत्रिक तपशील',
      common: { cancel: 'पेमेंट रद्द करा', back: 'मागे' },
      badge: { safe: 'सुरक्षित', warning: 'इशारा', hold: 'थांबवले', intercept: 'अवरोधित' },
      safe: {
        title: 'सर्व काही सुरक्षित दिसते',
        description: 'कोणतीही महत्त्वाची संशयास्पद हालचाल आढळली नाही. तुम्ही हे पेमेंट करू शकता.',
        seniorTitle: 'हे पेमेंट सुरक्षित दिसते',
        seniorDescription: 'आम्हाला काहीही असामान्य आढळले नाही. तुम्ही पुढे जाऊ शकता.',
        primaryCta: 'पेमेंट करा',
      },
      warning: {
        title: 'आम्हाला काहीतरी असामान्य आढळले',
        description: 'पुढे जाण्यापूर्वी या पेमेंटची खात्री करण्याची शिफारस आहे.',
        seniorTitle: 'पैसे देण्यापूर्वी तपासा',
        seniorDescription: 'या पेमेंटमध्ये काहीतरी असामान्य आहे. आधी खात्री करा.',
        primaryCta: 'खात्री करा आणि सुरू ठेवा',
      },
      hold: {
        title: 'उच्च धोका आढळला',
        description: 'तुमच्या सुरक्षिततेसाठी आम्ही हे पेमेंट तात्पुरते थांबवत आहोत.',
        seniorTitle: 'थांबा — हे पेमेंट रोखले आहे',
        seniorDescription: 'हे पेमेंट धोकादायक असू शकते. तुमचे पैसे वाचवण्यासाठी आम्ही ते थांबवले आहे.',
        primaryCta: 'विश्वासू संपर्काकडून खात्री करा',
      },
      intercept: {
        title: 'गंभीर धोका — पेमेंट अवरोधित',
        description: 'ही फसवणूक वाटते. तुमच्या संरक्षणासाठी आम्ही हे पेमेंट अवरोधित केले आहे.',
        seniorTitle: 'थांबा — आम्ही हे पेमेंट रोखले',
        seniorDescription: 'ही फसवणूक वाटते. तुमचे पैसे वाचवण्यासाठी आम्ही ते थांबवले.',
        primaryCta: 'विश्वासू व्यक्तीशी संपर्क करा',
        advice: 'संभाषण सुरू ठेवू नका आणि तुमचा PIN/OTP शेअर करू नका.',
      },
      factor: {
        audio: 'आवाज विश्लेषण', text: 'संदेश विश्लेषण', ocr: 'स्क्रीन तपासणी',
        behaviour: 'वर्तन विश्लेषण', beneficiary: 'लाभार्थी तपासणी', device: 'डिव्हाइस वर्तन',
      },
      severity: {
        normal: 'सामान्य', unusual: 'असामान्य', suspicious: 'संशयास्पद', critical: 'उच्च धोका',
        newBeneficiary: 'नवीन लाभार्थी',
      },
      evidenceSaved: 'सुरक्षा पुरावा जतन केला',
      alertSent: 'तुमची पेमेंट संरक्षण सूचना सुरक्षितपणे पाठवली आहे.',
    },

    trustedContact: {
      title: 'विश्वासू संपर्काकडून खात्री करा',
      calling: 'कॉल करत आहे…', connected: 'जोडले', waiting: 'पुष्टीची वाट पाहत आहे…',
      body: 'या पेमेंटची स्वतंत्र खात्री करण्यासाठी आम्ही तुमच्या विश्वासू संपर्काला कॉल करत आहोत.',
      endCall: 'कॉल संपवा', enterCode: 'कोड स्वतः टाका',
      noContact: 'विश्वासू संपर्क सेट नाही',
      noContactBody: 'या खात्री टप्प्यासाठी सेटिंग्जमध्ये विश्वासू संपर्क जोडा.',
      simulatedNote: 'या डेमो बिल्डमध्ये विश्वासू-संपर्क कॉल बनावट आहे.',
    },

    verification: {
      title: 'पडताळणी कोड टाका',
      body: 'तुमच्या विश्वासू संपर्काला त्यांना दिसणारा पडताळणी कोड विचारा.',
      verify: 'कोड तपासा', resendIn: '{{seconds}} सेकंदात पुन्हा पाठवा', resend: 'कोड पुन्हा पाठवा',
      invalid: 'हा कोड बरोबर नाही. पुन्हा प्रयत्न करा.',
      attemptsLeft: '{{count}} प्रयत्न शिल्लक',
      expired: 'हा कोड कालबाह्य झाला आहे. नवीन कोड मागा.',
      success: 'पडताळले', failed: 'पडताळणी अयशस्वी',
      frozenBody: 'खूप वेळा चुकीचे प्रयत्न. तुमच्या सुरक्षिततेसाठी हे पेमेंट गोठवले आहे.',
    },

    pin: {
      title: 'UPI PIN टाका', subtitle: 'बनावट अधिकृतता — खरा UPI PIN टाकू नका.',
      payingTo: 'यांना पेमेंट', securityNote: 'GuardPay द्वारे संरक्षित', cancel: 'रद्द करा',
    },

    success: {
      title: 'पेमेंट यशस्वी!', paidTo: 'यांना दिले', txnId: 'UPI व्यवहार ID',
      viewDetails: 'तपशील पहा', backHome: 'होमवर परत',
    },

    activity: {
      title: 'क्रियाकलाप',
      all: 'सर्व', safe: 'सुरक्षित', warning: 'इशारा', held: 'थांबवले', blocked: 'अवरोधित',
      empty: 'अद्याप काहीही नाही', emptyBody: 'तुमची पेमेंट त्यांच्या सुरक्षा निकालासह येथे दिसतील.',
      detailTitle: 'व्यवहार तपशील', decision: 'निर्णय', verification: 'पडताळणी',
      evidence: 'पुरावा', amount: 'रक्कम', beneficiary: 'लाभार्थी', time: 'वेळ',
      verified: 'पडताळले', notVerified: 'आवश्यक नाही', preserved: 'जतन केले',
    },

    settings: {
      title: 'सेटिंग्ज', protection: 'संरक्षण', about: 'माहिती',
      activeProtection: 'सक्रिय संरक्षण', seniorMode: 'ज्येष्ठ नागरिक मोड',
      trustedContacts: 'विश्वासू संपर्क', language: 'भाषा', voiceAlerts: 'आवाज सूचना',
      notifications: 'सूचना', privacy: 'गोपनीयता', aboutApp: 'GuardPay AI बद्दल',
      help: 'मदत', logout: 'लॉग आउट', on: 'चालू', off: 'बंद',
      contactsCount: '{{count}} संपर्क', addContact: 'संपर्क जोडा', removeContact: 'काढा',
      contactName: 'नाव', contactPhone: 'फोन नंबर', contactRelation: 'नाते',
      save: 'जतन करा', demoMode: 'डेमो मोड', demoModeHint: 'प्रात्यक्षिकासाठी परिस्थिती निवडा',
    },

    common: { retry: 'पुन्हा प्रयत्न', close: 'बंद करा', cancel: 'रद्द करा', confirm: 'पुष्टी करा', loading: 'लोड होत आहे…' },
  },

  ta: {
    nav: { home: 'முகப்பு', activity: 'செயல்பாடு', protection: 'பாதுகாப்பு', contacts: 'தொடர்புகள்', settings: 'அமைப்புகள்' },

    splash: { tagline: 'ஸ்மார்ட். பாதுகாப்பானது. கட்டுப்பாடு உங்களிடம்.', subtitle: 'ஒவ்வொரு UPI பணப்பரிமாற்றத்திற்கும் நேரடி பாதுகாப்பு.' },

    onboarding: {
      skip: 'தவிர்', next: 'அடுத்து', getStarted: 'தொடங்கு',
      s1Title: 'AI அடிப்படையிலான பணப் பாதுகாப்பு',
      s1Body: 'மோசடிகளிலிருந்து உங்களைக் காக்க, பணப்பரிமாற்றச் சூழல், அழைப்புகள், செய்திகள் மற்றும் சாதனச் சமிக்ஞைகளை நேரடியாக ஆய்வு செய்கிறோம்.',
      s2Title: 'பணம் அனுப்பும் முன் சோதனை',
      s2Body: 'பணம் அனுமதிக்கப்படும் முன்பே GuardPay சூழலைச் சரிபார்க்கிறது — பணம் போன பிறகு அல்ல.',
      s3Title: 'அபாயத்திற்கு ஏற்ற பாதுகாப்பு',
      s3Body: 'குறைந்த அபாயம் நேரடியாகச் செல்லும். அதிக அபாயத்தில் எச்சரிக்கை, நிறுத்தம், அல்லது நம்பகமானவரிடம் உறுதிப்படுத்தல்.',
    },

    permissions: {
      title: 'தேவையான அனுமதிகளை வழங்கவும்',
      subtitle: 'செயலில் உள்ள பாதுகாக்கப்பட்ட பணப்பரிமாற்ற அமர்வின் போது மட்டுமே GuardPay இந்த அனுமதிகளைப் பயன்படுத்தும்.',
      micName: 'மைக்ரோஃபோன்', micDesc: 'அனுமதிக்கப்பட்ட அழைப்பு மற்றும் ஒலிச் சூழலை ஆய்வு செய்ய',
      screenName: 'திரைப் பிடிப்பு', screenDesc: 'செயலில் உள்ள பாதுகாப்பு அமர்வின் போது திரைச் சூழலை ஆய்வு செய்ய',
      notifName: 'அறிவிப்புகள்', notifDesc: 'நேரடி அபாய மற்றும் பாதுகாப்பு எச்சரிக்கைகளைக் காட்ட',
      phoneName: 'தொலைபேசி / அழைப்பு நிலை', phoneDesc: 'செயலில் உள்ள அழைப்புச் சூழலைப் புரிந்துகொள்ள',
      allow: 'அனுமதி', granted: 'வழங்கப்பட்டது', denied: 'மறுக்கப்பட்டது', notRequested: 'அமைக்கப்படவில்லை',
      simulated: 'செயல்விளக்கச் சமிக்ஞை', continue: 'தொடரவும்',
      simulatedNote: 'குறிக்கப்பட்ட சமிக்ஞைகள் இந்த மாதிரியில் போலியானவை; உங்கள் சாதனத்தைப் படிக்காது.',
      screenCaptureNote: 'GuardPay இந்த அனுமதியை மட்டுமே கேட்கிறது — இந்த பதிப்பில் உங்கள் திரையை பதிவு, பார்வை அல்லது அனுப்பாது.',
    },

    dashboard: {
      protected: 'நீங்கள் பாதுகாக்கப்பட்டுள்ளீர்கள்',
      protectedSub: 'உங்கள் பணப்பரிமாற்ற அமர்வுகளுக்கு GuardPay பாதுகாப்பு செயலில் உள்ளது.',
      inactive: 'பாதுகாப்பு நிறுத்தப்பட்டது', inactiveSub: 'அமைப்புகளில் செயலில் உள்ள பாதுகாப்பை மீண்டும் இயக்கவும்.',
      summaryTitle: 'பாதுகாப்புச் சுருக்கம்',
      protectedCount: 'பாதுகாக்கப்பட்ட பணப்பரிமாற்றங்கள்', alertsCount: 'எச்சரிக்கைகள்', holdsCount: 'தலையீடுகள்',
      recentActivity: 'சமீபத்திய செயல்பாடு', viewAll: 'அனைத்தையும் காண்க', sendMoney: 'பணம் அனுப்பு',
      seniorMode: 'மூத்த குடிமக்கள் முறை',
      seniorModeHint: 'பெரிய எழுத்து, எளிய சொற்கள் மற்றும் நிற-மட்டும் அபாய அளவீடு',
      language: 'மொழி', noActivity: 'இதுவரை பணப்பரிமாற்றம் இல்லை',
      noActivityBody: 'உங்கள் பாதுகாக்கப்பட்ட பணப்பரிமாற்றங்கள் இங்கே தோன்றும்.',
    },

    payment: {
      title: 'பணம் செலுத்து', upiLabel: 'UPI ID / எண்ணை உள்ளிடவும்', upiPlaceholder: 'name@bank',
      amountLabel: 'தொகையை உள்ளிடவும்', noteLabel: 'குறிப்பு சேர் (விருப்பம்)', notePlaceholder: 'இது எதற்காக?',
      proceed: 'பணம் செலுத்த தொடரவும்', recentBeneficiaries: 'சமீபத்திய பயனாளிகள்',
      newPayee: 'புதியது', trusted: 'நம்பகமானது', invalidUpi: 'சரியான UPI ID உள்ளிடவும்',
      invalidAmount: 'பூஜ்ஜியத்தை விட அதிக தொகையை உள்ளிடவும்',
    },

    session: {
      active: 'GuardPay பாதுகாப்பு செயலில்',
      checking: 'அனுமதிக்கும் முன் இந்தப் பணப்பரிமாற்றத்தில் சந்தேகத்திற்குரிய செயல்பாடு சரிபார்க்கப்படுகிறது.',
      evaluating: 'பணப்பரிமாற்றச் சூழல் ஆய்வு…', complete: 'சோதனை முடிந்தது',
      unavailable: 'பாதுகாப்புச் சோதனையை முடிக்க முடியவில்லை',
      unavailableBody: 'பாதுகாப்புச் சோதனையை முடிக்க முடியவில்லை, எனவே தொடர்வதற்கு முன் உறுதிப்படுத்தவும்.',
    },

    risk: {
      scoreLabel: 'அபாய மதிப்பெண்', outOf: '/ 100', whatWeChecked: 'நாங்கள் சரிபார்த்தவை',
      whyFlagged: 'இந்தப் பணப்பரிமாற்றத்தை ஏன் குறித்தோம்', technicalDetails: 'தொழில்நுட்ப விவரங்கள்',
      common: { cancel: 'பணப்பரிமாற்றத்தை ரத்து செய்', back: 'பின்' },
      badge: { safe: 'பாதுகாப்பானது', warning: 'எச்சரிக்கை', hold: 'நிறுத்தப்பட்டது', intercept: 'தடுக்கப்பட்டது' },
      safe: {
        title: 'எல்லாம் பாதுகாப்பாகத் தெரிகிறது',
        description: 'குறிப்பிடத்தக்க சந்தேகத்திற்குரிய செயல்பாடு எதுவும் கண்டறியப்படவில்லை. நீங்கள் தொடரலாம்.',
        seniorTitle: 'இந்தப் பணப்பரிமாற்றம் பாதுகாப்பானது',
        seniorDescription: 'அசாதாரணமாக எதுவும் இல்லை. நீங்கள் தொடரலாம்.',
        primaryCta: 'பணம் செலுத்த தொடரவும்',
      },
      warning: {
        title: 'அசாதாரணமான ஒன்றைக் கண்டறிந்தோம்',
        description: 'தொடர்வதற்கு முன் இந்தப் பணப்பரிமாற்றத்தை உறுதிப்படுத்த பரிந்துரைக்கிறோம்.',
        seniorTitle: 'பணம் அனுப்பும் முன் சரிபார்க்கவும்',
        seniorDescription: 'இந்தப் பணப்பரிமாற்றத்தில் ஏதோ அசாதாரணம். முதலில் உறுதிப்படுத்தவும்.',
        primaryCta: 'உறுதிப்படுத்தி தொடரவும்',
      },
      hold: {
        title: 'அதிக அபாயம் கண்டறியப்பட்டது',
        description: 'உங்கள் பாதுகாப்பிற்காக இந்தப் பணப்பரிமாற்றத்தைத் தற்காலிகமாக நிறுத்துகிறோம்.',
        seniorTitle: 'நிறுத்துங்கள் — இது நிறுத்தப்பட்டுள்ளது',
        seniorDescription: 'இது ஆபத்தானதாக இருக்கலாம். உங்கள் பணத்தைக் காக்க நிறுத்தியுள்ளோம்.',
        primaryCta: 'நம்பகமான தொடர்பிடம் உறுதிப்படுத்து',
      },
      intercept: {
        title: 'தீவிர அபாயம் — பணப்பரிமாற்றம் தடுக்கப்பட்டது',
        description: 'இது மோசடி போலத் தெரிகிறது. உங்களைப் பாதுகாக்க இதைத் தடுத்துள்ளோம்.',
        seniorTitle: 'நிறுத்துங்கள் — நாங்கள் இதைத் தடுத்தோம்',
        seniorDescription: 'இது மோசடி போலத் தெரிகிறது. உங்கள் பணத்தைக் காக்க நிறுத்தினோம்.',
        primaryCta: 'நம்பகமான நபரைத் தொடர்பு கொள்',
        advice: 'உரையாடலைத் தொடராதீர்கள்; உங்கள் PIN/OTP-ஐப் பகிர வேண்டாம்.',
      },
      factor: {
        audio: 'குரல் பகுப்பாய்வு', text: 'செய்திப் பகுப்பாய்வு', ocr: 'திரைச் சோதனை',
        behaviour: 'நடத்தைப் பகுப்பாய்வு', beneficiary: 'பயனாளி சோதனை', device: 'சாதன நடத்தை',
      },
      severity: {
        normal: 'இயல்பானது', unusual: 'அசாதாரணம்', suspicious: 'சந்தேகத்திற்குரியது', critical: 'அதிக அபாயம்',
        newBeneficiary: 'புதிய பயனாளி',
      },
      evidenceSaved: 'பாதுகாப்புச் சான்று சேமிக்கப்பட்டது',
      alertSent: 'உங்கள் பணப் பாதுகாப்பு எச்சரிக்கை பாதுகாப்பாக அனுப்பப்பட்டது.',
    },

    trustedContact: {
      title: 'நம்பகமான தொடர்பிடம் உறுதிப்படுத்து',
      calling: 'அழைக்கிறது…', connected: 'இணைக்கப்பட்டது', waiting: 'உறுதிப்படுத்தலுக்குக் காத்திருக்கிறது…',
      body: 'இந்தப் பணப்பரிமாற்றத்தைத் தனியாக உறுதிப்படுத்த உங்கள் நம்பகமான தொடர்பை அழைக்கிறோம்.',
      endCall: 'அழைப்பை முடி', enterCode: 'குறியீட்டை கைமுறையாக உள்ளிடு',
      noContact: 'நம்பகமான தொடர்பு அமைக்கப்படவில்லை',
      noContactBody: 'இந்த உறுதிப்படுத்தல் படிநிலைக்கு அமைப்புகளில் நம்பகமான தொடர்பைச் சேர்க்கவும்.',
      simulatedNote: 'இந்த செயல்விளக்கப் பதிப்பில் நம்பகமான-தொடர்பு அழைப்பு போலியானது.',
    },

    verification: {
      title: 'சரிபார்ப்புக் குறியீட்டை உள்ளிடவும்',
      body: 'உங்கள் நம்பகமான தொடர்பிடம் அவர்களுக்குக் காட்டப்படும் சரிபார்ப்புக் குறியீட்டைக் கேளுங்கள்.',
      verify: 'குறியீட்டைச் சரிபார்', resendIn: '{{seconds}} வினாடிகளில் மீண்டும் அனுப்பு', resend: 'குறியீட்டை மீண்டும் அனுப்பு',
      invalid: 'இந்தக் குறியீடு சரியில்லை. மீண்டும் முயற்சிக்கவும்.',
      attemptsLeft: '{{count}} முயற்சிகள் மீதம்',
      expired: 'இந்தக் குறியீடு காலாவதியானது. புதியதைக் கோரவும்.',
      success: 'சரிபார்க்கப்பட்டது', failed: 'சரிபார்ப்பு தோல்வி',
      frozenBody: 'பல தவறான முயற்சிகள். உங்கள் பாதுகாப்பிற்காக இது முடக்கப்பட்டுள்ளது.',
    },

    pin: {
      title: 'UPI PIN உள்ளிடவும்', subtitle: 'போலி அங்கீகாரம் — உண்மையான UPI PIN-ஐ உள்ளிட வேண்டாம்.',
      payingTo: 'பெறுநர்', securityNote: 'GuardPay ஆல் பாதுகாக்கப்பட்டது', cancel: 'ரத்து',
    },

    success: {
      title: 'பணப்பரிமாற்றம் வெற்றி!', paidTo: 'செலுத்தப்பட்டது', txnId: 'UPI பரிவர்த்தனை ID',
      viewDetails: 'விவரங்களைக் காண்க', backHome: 'முகப்புக்குத் திரும்பு',
    },

    activity: {
      title: 'செயல்பாடு',
      all: 'அனைத்தும்', safe: 'பாதுகாப்பானது', warning: 'எச்சரிக்கை', held: 'நிறுத்தப்பட்டது', blocked: 'தடுக்கப்பட்டது',
      empty: 'இதுவரை எதுவும் இல்லை', emptyBody: 'நீங்கள் செய்யும் பணப்பரிமாற்றங்கள் அவற்றின் பாதுகாப்பு முடிவுடன் இங்கே தோன்றும்.',
      detailTitle: 'பரிவர்த்தனை விவரங்கள்', decision: 'முடிவு', verification: 'சரிபார்ப்பு',
      evidence: 'சான்று', amount: 'தொகை', beneficiary: 'பயனாளி', time: 'நேரம்',
      verified: 'சரிபார்க்கப்பட்டது', notVerified: 'தேவையில்லை', preserved: 'சேமிக்கப்பட்டது',
    },

    settings: {
      title: 'அமைப்புகள்', protection: 'பாதுகாப்பு', about: 'பற்றி',
      activeProtection: 'செயலில் உள்ள பாதுகாப்பு', seniorMode: 'மூத்த குடிமக்கள் முறை',
      trustedContacts: 'நம்பகமான தொடர்புகள்', language: 'மொழி', voiceAlerts: 'குரல் எச்சரிக்கைகள்',
      notifications: 'அறிவிப்புகள்', privacy: 'தனியுரிமை', aboutApp: 'GuardPay AI பற்றி',
      help: 'உதவி', logout: 'வெளியேறு', on: 'இயக்கு', off: 'அணை',
      contactsCount: '{{count}} தொடர்புகள்', addContact: 'தொடர்பைச் சேர்', removeContact: 'நீக்கு',
      contactName: 'பெயர்', contactPhone: 'தொலைபேசி எண்', contactRelation: 'உறவு',
      save: 'சேமி', demoMode: 'செயல்விளக்க முறை', demoModeHint: 'விளக்கத்திற்கு ஒரு சூழ்நிலையைத் தேர்வுசெய்',
    },

    common: { retry: 'மீண்டும் முயற்சி', close: 'மூடு', cancel: 'ரத்து', confirm: 'உறுதிப்படுத்து', loading: 'ஏற்றுகிறது…' },
  },
} as const;

export default screenTranslations;
