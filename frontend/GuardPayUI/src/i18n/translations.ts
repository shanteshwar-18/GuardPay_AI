/**
 * GuardPay AI — i18n Translations
 * Warning / Hold / Intercept message templates in EN, HI, MR, TA.
 * Used by i18next and the speak() TTS stub.
 *
 * Interpolation keys:
 *   {{beneficiary}} — resolved payee display name
 *   {{amount}}      — formatted INR string (e.g. "₹5,000")
 */

export const translations = {
  en: {
    translation: {
      badge: {
        new: 'NEW',
      },
      warning: {
        mainMessage:
          'This payment of {{amount}} to {{beneficiary}} shows signs of fraud. Please verify before proceeding.',
        title: '⚠️ Payment Warning',
        proceed: 'Proceed Anyway',
        cancel: 'Cancel Transaction',
        factorsTitle: 'Risk Factors Detected',
      },
      hold: {
        mainMessage:
          'Your payment of {{amount}} to {{beneficiary}} is temporarily on hold. Please wait for verification.',
        title: '🔴 Payment on Hold',
      },
      intercept: {
        mainMessage:
          'Payment of {{amount}} to {{beneficiary}} has been blocked. Your trusted contact is being notified.',
        title: '🔒 Payment Blocked',
        cancel: 'Cancel Transaction',
        statusWaiting: 'Waiting for trusted contact…',
        statusReleased: 'Released by trusted contact ✓',
        statusFrozen: 'Frozen by trusted contact ✗',
      },
      riskEval: {
        checking: 'Checking transaction safety…',
        unavailable: 'Evaluation unavailable, proceeding with caution',
      },
      home: {
        balance: 'Account Balance',
        sendMoney: 'Send Money',
        recentTransactions: 'Recent Transactions',
      },
      beneficiary: {
        inputPlaceholder: 'Enter UPI ID (e.g. name@bank)',
        resolve: 'Resolve',
        continue: 'Continue',
        newPayee: 'First-time payee — verify carefully',
      },
      amount: {
        placeholder: 'Enter amount',
        notePlaceholder: 'Add a note (optional)',
        confirm: 'Confirm Payment',
      },
      pin: {
        title: 'Enter UPI PIN',
        subtitle: 'Pay {{amount}} to {{beneficiary}}',
        success: 'Payment Successful!',
      },
      call: {
        banner: 'Active Call: Unknown Caller',
      },
    },
  },

  hi: {
    translation: {
      badge: {
        new: 'नया',
      },
      warning: {
        mainMessage:
          '{{beneficiary}} को ₹{{amount}} का यह भुगतान धोखाधड़ी के संकेत दिखाता है। आगे बढ़ने से पहले कृपया सत्यापित करें।',
        title: '⚠️ भुगतान चेतावनी',
        proceed: 'फिर भी आगे बढ़ें',
        cancel: 'लेन-देन रद्द करें',
        factorsTitle: 'जोखिम कारण पाए गए',
      },
      hold: {
        mainMessage:
          '{{beneficiary}} को {{amount}} का भुगतान अस्थायी रूप से रोका गया है। कृपया सत्यापन की प्रतीक्षा करें।',
        title: '🔴 भुगतान रोका गया',
      },
      intercept: {
        mainMessage:
          '{{beneficiary}} को {{amount}} का भुगतान अवरुद्ध कर दिया गया है। आपके विश्वसनीय संपर्क को सूचित किया जा रहा है।',
        title: '🔒 भुगतान अवरुद्ध',
        cancel: 'लेन-देन रद्द करें',
        statusWaiting: 'विश्वसनीय संपर्क की प्रतीक्षा में…',
        statusReleased: 'विश्वसनीय संपर्क द्वारा अनुमोदित ✓',
        statusFrozen: 'विश्वसनीय संपर्क द्वारा फ्रीज़ ✗',
      },
      riskEval: {
        checking: 'लेन-देन सुरक्षा जाँची जा रही है…',
        unavailable: 'मूल्यांकन उपलब्ध नहीं, सावधानी के साथ आगे बढ़ रहे हैं',
      },
      home: {
        balance: 'खाता शेष',
        sendMoney: 'पैसे भेजें',
        recentTransactions: 'हाल के लेन-देन',
      },
      beneficiary: {
        inputPlaceholder: 'UPI ID दर्ज करें (जैसे name@bank)',
        resolve: 'सत्यापित करें',
        continue: 'जारी रखें',
        newPayee: 'पहली बार का प्राप्तकर्ता — सावधानी से जाँचें',
      },
      amount: {
        placeholder: 'राशि दर्ज करें',
        notePlaceholder: 'नोट जोड़ें (वैकल्पिक)',
        confirm: 'भुगतान की पुष्टि करें',
      },
      pin: {
        title: 'UPI PIN दर्ज करें',
        subtitle: '{{beneficiary}} को {{amount}} भेजें',
        success: 'भुगतान सफल!',
      },
      call: {
        banner: 'सक्रिय कॉल: अज्ञात कॉलर',
      },
    },
  },

  mr: {
    translation: {
      badge: {
        new: 'नवीन',
      },
      warning: {
        mainMessage:
          '{{beneficiary}} यांना {{amount}} चे हे पेमेंट फसवणुकीची चिन्हे दाखवते. कृपया पुढे जाण्यापूर्वी तपासा.',
        title: '⚠️ पेमेंट चेतावणी',
        proceed: 'तरीही पुढे जा',
        cancel: 'व्यवहार रद्द करा',
        factorsTitle: 'धोक्याचे घटक आढळले',
      },
      hold: {
        mainMessage:
          '{{beneficiary}} यांना {{amount}} चे पेमेंट तात्पुरते थांबवले आहे. कृपया तपासणीची प्रतीक्षा करा.',
        title: '🔴 पेमेंट थांबवले',
      },
      intercept: {
        mainMessage:
          '{{beneficiary}} यांना {{amount}} चे पेमेंट अवरोधित केले आहे. तुमच्या विश्वसनीय संपर्काला सूचित केले जात आहे.',
        title: '🔒 पेमेंट अवरोधित',
        cancel: 'व्यवहार रद्द करा',
        statusWaiting: 'विश्वसनीय संपर्काची वाट पाहत आहे…',
        statusReleased: 'विश्वसनीय संपर्काने मंजूर केले ✓',
        statusFrozen: 'विश्वसनीय संपर्काने फ्रीज केले ✗',
      },
      riskEval: {
        checking: 'व्यवहार सुरक्षितता तपासत आहे…',
        unavailable: 'मूल्यांकन उपलब्ध नाही, सावधगिरीने पुढे जात आहे',
      },
      home: {
        balance: 'खाते शिल्लक',
        sendMoney: 'पैसे पाठवा',
        recentTransactions: 'अलीकडील व्यवहार',
      },
      beneficiary: {
        inputPlaceholder: 'UPI ID टाका (उदा. name@bank)',
        resolve: 'तपासा',
        continue: 'पुढे जा',
        newPayee: 'प्रथमच प्राप्तकर्ता — काळजीपूर्वक तपासा',
      },
      amount: {
        placeholder: 'रक्कम टाका',
        notePlaceholder: 'नोट जोडा (पर्यायी)',
        confirm: 'पेमेंट निश्चित करा',
      },
      pin: {
        title: 'UPI PIN टाका',
        subtitle: '{{beneficiary}} यांना {{amount}} पाठवा',
        success: 'पेमेंट यशस्वी!',
      },
      call: {
        banner: 'सक्रिय कॉल: अज्ञात कॉलर',
      },
    },
  },

  ta: {
    translation: {
      badge: {
        new: 'புதிய',
      },
      warning: {
        mainMessage:
          '{{beneficiary}} க்கு {{amount}} இந்த கட்டணம் மோசடியின் அறிகுறிகளைக் காட்டுகிறது. தொடர்வதற்கு முன் சரிபார்க்கவும்.',
        title: '⚠️ கட்டண எச்சரிக்கை',
        proceed: 'எப்படியும் தொடர்க',
        cancel: 'பரிவர்த்தனையை ரத்து செய்',
        factorsTitle: 'ஆபத்து காரணிகள் கண்டுபிடிக்கப்பட்டன',
      },
      hold: {
        mainMessage:
          '{{beneficiary}} க்கு {{amount}} கட்டணம் தற்காலிகமாக நிறுத்தப்பட்டுள்ளது. சரிபார்ப்புக்கு காத்திருக்கவும்.',
        title: '🔴 கட்டணம் நிறுத்தப்பட்டது',
      },
      intercept: {
        mainMessage:
          '{{beneficiary}} க்கு {{amount}} கட்டணம் தடுக்கப்பட்டுள்ளது. உங்கள் நம்பகமான தொடர்பாளர் தெரிவிக்கப்படுகிறார்.',
        title: '🔒 கட்டணம் தடுக்கப்பட்டது',
        cancel: 'பரிவர்த்தனையை ரத்து செய்',
        statusWaiting: 'நம்பகமான தொடர்பாளருக்காக காத்திருக்கிறோம்…',
        statusReleased: 'நம்பகமான தொடர்பாளரால் அனுமதிக்கப்பட்டது ✓',
        statusFrozen: 'நம்பகமான தொடர்பாளரால் உறைக்கப்பட்டது ✗',
      },
      riskEval: {
        checking: 'பரிவர்த்தனை பாதுகாப்பை சரிபார்க்கிறது…',
        unavailable: 'மதிப்பீடு கிடைக்கவில்லை, எச்சரிக்கையுடன் தொடர்கிறது',
      },
      home: {
        balance: 'கணக்கு இருப்பு',
        sendMoney: 'பணம் அனுப்பு',
        recentTransactions: 'சமீபத்திய பரிவர்த்தனைகள்',
      },
      beneficiary: {
        inputPlaceholder: 'UPI ID உள்ளிடவும் (எ.கா. name@bank)',
        resolve: 'சரிபார்',
        continue: 'தொடர்',
        newPayee: 'முதல்முறை பெறுபவர் — கவனமாக சரிபார்க்கவும்',
      },
      amount: {
        placeholder: 'தொகை உள்ளிடவும்',
        notePlaceholder: 'குறிப்பு சேர்க்கவும் (விரும்பினால்)',
        confirm: 'கட்டணத்தை உறுதிப்படுத்தவும்',
      },
      pin: {
        title: 'UPI PIN உள்ளிடவும்',
        subtitle: '{{beneficiary}} க்கு {{amount}} அனுப்பவும்',
        success: 'கட்டணம் வெற்றிகரமானது!',
      },
      call: {
        banner: 'செயலில் உள்ள அழைப்பு: தெரியாத அழைப்பாளர்',
      },
    },
  },
} as const;

export type SupportedLanguage = keyof typeof translations;
