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
      common: {
        ok: 'OK',
        continue: 'Continue',
      },
      warning: {
        mainMessage:
          'This payment of {{amount}} to {{beneficiary}} shows signs of fraud. Please verify before proceeding.',
        title: '⚠️ Payment Warning',
        proceed: 'Proceed Anyway',
        cancel: 'Cancel Transaction',
        factorsTitle: 'Risk Factors Detected',
        riskLevel: 'Risk Level: WARNING',
      },
      hold: {
        mainMessage:
          'Your payment of {{amount}} to {{beneficiary}} is temporarily on hold. Please wait for verification.',
        title: '🔴 Payment on Hold',
        coolingOff: 'COOLING-OFF PERIOD',
        reviewNote: 'Please review the risk factors below, or enter the OTP to continue',
        expiredNote: 'Time expired — transaction cancelled',
        verifyTitle: 'Step-Up Identity Verification',
        verifySubtitle: 'Enter the 4-digit code sent to your mobile',
        evidenceNotice:
          'Encrypted audit record (AES-256) logged with transaction ID for customer dispute protection.',
        cancelledTitle: 'Transaction Cancelled',
        cancelledBody: 'Cooling-off period expired. Returning to home screen.',
        verifiedTitle: 'Verification Successful',
        verifiedBody: 'Step-up verification complete. You may now enter your UPI PIN.',
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
        subtitle: 'Analysing voice, beneficiary and behaviour signals',
      },
      home: {
        balance: 'Account Balance',
        sendMoney: 'Send Money',
        recentTransactions: 'Recent Transactions',
        seniorMode: 'Senior Citizen Mode',
        seniorModeHint: 'Larger text, simpler wording and colour-only risk meters',
        language: 'Language',
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
      common: {
        ok: 'ठीक है',
        continue: 'जारी रखें',
      },
      warning: {
        // NOTE: {{amount}} is already a formatted INR string (e.g. "₹5,000") —
        // never prefix it with another ₹ here.
        mainMessage:
          '{{beneficiary}} को {{amount}} का यह भुगतान धोखाधड़ी के संकेत दिखाता है। आगे बढ़ने से पहले कृपया सत्यापित करें।',
        title: '⚠️ भुगतान चेतावनी',
        proceed: 'फिर भी आगे बढ़ें',
        cancel: 'लेन-देन रद्द करें',
        factorsTitle: 'जोखिम कारण पाए गए',
        riskLevel: 'जोखिम स्तर: चेतावनी',
      },
      hold: {
        mainMessage:
          '{{beneficiary}} को {{amount}} का भुगतान अस्थायी रूप से रोका गया है। कृपया सत्यापन की प्रतीक्षा करें।',
        title: '🔴 भुगतान रोका गया',
        coolingOff: 'प्रतीक्षा अवधि',
        reviewNote: 'कृपया नीचे दिए गए जोखिम कारण देखें, या जारी रखने के लिए OTP दर्ज करें',
        expiredNote: 'समय समाप्त — लेन-देन रद्द',
        verifyTitle: 'अतिरिक्त पहचान सत्यापन',
        verifySubtitle: 'आपके मोबाइल पर भेजा गया 4-अंकों का कोड दर्ज करें',
        evidenceNotice:
          'विवाद संरक्षण के लिए लेन-देन आईडी के साथ एन्क्रिप्टेड ऑडिट रिकॉर्ड (AES-256) सुरक्षित किया गया।',
        cancelledTitle: 'लेन-देन रद्द',
        cancelledBody: 'प्रतीक्षा अवधि समाप्त हो गई। होम स्क्रीन पर लौट रहे हैं।',
        verifiedTitle: 'सत्यापन सफल',
        verifiedBody: 'अतिरिक्त सत्यापन पूर्ण। अब आप अपना UPI PIN दर्ज कर सकते हैं।',
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
        subtitle: 'आवाज़, प्राप्तकर्ता और व्यवहार संकेतों का विश्लेषण',
      },
      home: {
        balance: 'खाता शेष',
        sendMoney: 'पैसे भेजें',
        recentTransactions: 'हाल के लेन-देन',
        seniorMode: 'वरिष्ठ नागरिक मोड',
        seniorModeHint: 'बड़ा टेक्स्ट, सरल भाषा और केवल रंग वाला जोखिम मीटर',
        language: 'भाषा',
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
      common: {
        ok: 'ठीक आहे',
        continue: 'पुढे जा',
      },
      warning: {
        mainMessage:
          '{{beneficiary}} यांना {{amount}} चे हे पेमेंट फसवणुकीची चिन्हे दाखवते. कृपया पुढे जाण्यापूर्वी तपासा.',
        title: '⚠️ पेमेंट चेतावणी',
        proceed: 'तरीही पुढे जा',
        cancel: 'व्यवहार रद्द करा',
        factorsTitle: 'धोक्याचे घटक आढळले',
        riskLevel: 'धोका पातळी: चेतावणी',
      },
      hold: {
        mainMessage:
          '{{beneficiary}} यांना {{amount}} चे पेमेंट तात्पुरते थांबवले आहे. कृपया तपासणीची प्रतीक्षा करा.',
        title: '🔴 पेमेंट थांबवले',
        coolingOff: 'प्रतीक्षा कालावधी',
        reviewNote: 'कृपया खालील धोक्याचे घटक तपासा, किंवा पुढे जाण्यासाठी OTP टाका',
        expiredNote: 'वेळ संपली — व्यवहार रद्द',
        verifyTitle: 'अतिरिक्त ओळख पडताळणी',
        verifySubtitle: 'तुमच्या मोबाइलवर पाठवलेला ४ अंकी कोड टाका',
        evidenceNotice:
          'वादाच्या संरक्षणासाठी व्यवहार आयडीसह एन्क्रिप्टेड ऑडिट रेकॉर्ड (AES-256) जतन केला आहे.',
        cancelledTitle: 'व्यवहार रद्द',
        cancelledBody: 'प्रतीक्षा कालावधी संपला. होम स्क्रीनवर परत जात आहे.',
        verifiedTitle: 'पडताळणी यशस्वी',
        verifiedBody: 'अतिरिक्त पडताळणी पूर्ण. आता तुम्ही तुमचा UPI PIN टाकू शकता.',
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
        subtitle: 'आवाज, प्राप्तकर्ता आणि वर्तन संकेतांचे विश्लेषण',
      },
      home: {
        balance: 'खाते शिल्लक',
        sendMoney: 'पैसे पाठवा',
        recentTransactions: 'अलीकडील व्यवहार',
        seniorMode: 'ज्येष्ठ नागरिक मोड',
        seniorModeHint: 'मोठा मजकूर, सोपी भाषा आणि फक्त रंगाचा धोका मीटर',
        language: 'भाषा',
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
      common: {
        ok: 'சரி',
        continue: 'தொடர்',
      },
      warning: {
        mainMessage:
          '{{beneficiary}} க்கு {{amount}} இந்த கட்டணம் மோசடியின் அறிகுறிகளைக் காட்டுகிறது. தொடர்வதற்கு முன் சரிபார்க்கவும்.',
        title: '⚠️ கட்டண எச்சரிக்கை',
        proceed: 'எப்படியும் தொடர்க',
        cancel: 'பரிவர்த்தனையை ரத்து செய்',
        factorsTitle: 'ஆபத்து காரணிகள் கண்டுபிடிக்கப்பட்டன',
        riskLevel: 'ஆபத்து நிலை: எச்சரிக்கை',
      },
      hold: {
        mainMessage:
          '{{beneficiary}} க்கு {{amount}} கட்டணம் தற்காலிகமாக நிறுத்தப்பட்டுள்ளது. சரிபார்ப்புக்கு காத்திருக்கவும்.',
        title: '🔴 கட்டணம் நிறுத்தப்பட்டது',
        coolingOff: 'காத்திருப்பு காலம்',
        reviewNote: 'கீழே உள்ள ஆபத்து காரணிகளைப் பாருங்கள், அல்லது தொடர OTP ஐ உள்ளிடவும்',
        expiredNote: 'நேரம் முடிந்தது — பரிவர்த்தனை ரத்து',
        verifyTitle: 'கூடுதல் அடையாள சரிபார்ப்பு',
        verifySubtitle: 'உங்கள் மொபைலுக்கு அனுப்பப்பட்ட 4 இலக்கக் குறியீட்டை உள்ளிடவும்',
        evidenceNotice:
          'தகராறு பாதுகாப்புக்காக பரிவர்த்தனை ஐடியுடன் மறையாக்கப்பட்ட தணிக்கைப் பதிவு (AES-256) சேமிக்கப்பட்டது.',
        cancelledTitle: 'பரிவர்த்தனை ரத்து',
        cancelledBody: 'காத்திருப்பு காலம் முடிந்தது. முகப்புத் திரைக்குத் திரும்புகிறது.',
        verifiedTitle: 'சரிபார்ப்பு வெற்றி',
        verifiedBody: 'கூடுதல் சரிபார்ப்பு முடிந்தது. இப்போது உங்கள் UPI PIN ஐ உள்ளிடலாம்.',
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
        subtitle: 'குரல், பெறுநர் மற்றும் நடத்தை சமிக்ஞைகளை பகுப்பாய்வு செய்கிறது',
      },
      home: {
        balance: 'கணக்கு இருப்பு',
        sendMoney: 'பணம் அனுப்பு',
        recentTransactions: 'சமீபத்திய பரிவர்த்தனைகள்',
        seniorMode: 'மூத்த குடிமக்கள் பயன்முறை',
        seniorModeHint: 'பெரிய எழுத்து, எளிய மொழி மற்றும் வண்ணம் மட்டுமே கொண்ட ஆபத்து அளவி',
        language: 'மொழி',
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
