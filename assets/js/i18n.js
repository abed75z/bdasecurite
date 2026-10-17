/* =========================================================
   TEXTES DES SCRIPTS EN ANGLAIS ET EN ARABE
   Chargé en premier sur les pages /en/ et /ar/ (ajouté par outils/i18n/generer.py).
   window.T('texte français', { variables }) renvoie la traduction de la langue de la page,
   ou le texte français s'il n'y en a pas. Les pages françaises n'en ont pas besoin :
   chaque script garde le français par défaut.
   ========================================================= */
(() => {
  const L = (document.documentElement.lang || 'fr').slice(0, 2);
  const D = {
    en: {
      // Menu « Mon compte » et fenêtres communes
      'Mon compte': 'My account', 'Espace client': 'Client area', 'Espace agent': 'Staff area',
      'Devis, factures, missions': 'Quotes, invoices, assignments', 'Planning, pointage, documents': 'Schedule, time clock, documents',
      'Fermer': 'Close', 'Bientôt': 'Coming soon',
      'Cette option n’est pas encore disponible': 'This option is not available yet',
      'La réservation de VTC en ligne arrive très bientôt. En attendant, notre équipe vous répond directement.': 'Online chauffeur booking is coming very soon. In the meantime, our team will answer you directly.',
      'Demander un devis': 'Request a quote', 'Fermé': 'Closed',
      'Demandes en ligne momentanément fermées': 'Online requests temporarily closed',
      'Pour un devis, appelez-nous ou écrivez-nous sur WhatsApp : nous vous répondons rapidement.': 'For a quote, call us or message us on WhatsApp: we will reply quickly.',
      'Les candidatures sont fermées pour le moment': 'Applications are closed for the moment',
      'Merci de votre intérêt pour BDA Security Group. Revenez bientôt : nos prochains postes seront publiés ici.': 'Thank you for your interest in BDA Security Group. Come back soon: our next positions will be published here.',
      'Le dépôt d’avis est momentanément fermé': 'Review submissions are temporarily closed',
      'Merci de votre confiance ! Vous pouvez toujours lire les avis de nos clients sur cette page.': 'Thank you for your trust! You can still read our clients’ reviews on this page.',
      'Page indisponible': 'Page unavailable', 'Cette page n’est pas disponible pour le moment.': 'This page is not available at the moment.',
      'Notre équipe reste joignable 24h/24 pour répondre à votre demande.': 'Our team remains available 24/7 to handle your request.',
      'Retour à l’accueil': 'Back to home',
      // Être rappelé
      'Indiquez votre nom.': 'Please enter your name.', 'Indiquez un numéro de téléphone valide.': 'Please enter a valid phone number.',
      'Choisissez un jour et un moment.': 'Please choose a day and a time.',
      'le matin (9h – 12h)': 'in the morning (9 am – 12 pm)', 'le midi (12h – 14h)': 'at lunchtime (12 pm – 2 pm)',
      'l’après-midi (14h – 18h)': 'in the afternoon (2 pm – 6 pm)', 'en soirée (18h – 21h)': 'in the evening (6 pm – 9 pm)',
      'matin, 9h – 12h': 'morning, 9 am – 12 pm', 'midi, 12h – 14h': 'lunchtime, 12 pm – 2 pm',
      'après-midi, 14h – 18h': 'afternoon, 2 pm – 6 pm', 'soirée, 18h – 21h': 'evening, 6 pm – 9 pm',
      'dès que possible': 'as soon as possible',
      'Un responsable vous rappelle {quand} au {tel}.': 'A manager will call you back {quand} on {tel}.',
      'Envoi impossible pour le moment.': 'Unable to send at the moment.',
      'Vous pouvez aussi nous appeler au 06 11 67 86 25.': 'You can also call us on +33 6 11 67 86 25.',
      // Devis
      'Ex. : lieu de la mission, dates et horaires, nombre d\'agents souhaité, type d\'événement, nombre d\'invités…': 'E.g. assignment location, dates and hours, number of officers required, type of event, number of guests…',
      'Ex. : adresse de départ et d\'arrivée, heure de prise en charge, nombre de passagers et de bagages, numéro de vol ou de train…': 'E.g. pick-up and drop-off addresses, pick-up time, number of passengers and pieces of luggage, flight or train number…',
      'Ex. : programme de la journée ou de la soirée, lieux, nombre de personnes à accompagner, niveau de discrétion souhaité…': 'E.g. schedule for the day or evening, venues, number of people to accompany, level of discretion required…',
      'Choisissez une prestation pour continuer.': 'Choose a service to continue.',
      'Merci de cocher la case d\'accord pour envoyer votre demande.': 'Please tick the consent box to send your request.',
      'Étape {n} sur {t}': 'Step {n} of {t}',
      'Le formulaire doit d\'abord être activé : cliquez sur « Activate Form » dans l\'email reçu de FormSubmit, puis renvoyez la demande.': 'The form must first be activated. Please try again later or call us.',
      'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous directement.': 'Sending failed. Check your connection and try again, or call us directly.',
      'Gardiennage & surveillance de site': 'Manned guarding & site surveillance', 'Protection rapprochée': 'Close protection',
      'Sécurité événementielle': 'Event security', 'Trajet simple': 'Single journey', 'Chauffeur à disposition': 'Chauffeur at your disposal',
      'Chauffeur + agent de sécurité': 'Chauffeur + security officer', 'Autre demande': 'Other request',
      // Merci
      'Merci, {nom} !': 'Thank you, {nom}!',
      ' pour le {date}': ' for {date}', ' à {heure}': ' at {heure}',
      'Votre demande de devis {prestation}{quand} a bien été transmise à notre équipe. Nous l\'étudions et revenons vers vous très rapidement, par téléphone ou par email.': 'Your quote request {prestation}{quand} has been sent to our team. We are reviewing it and will get back to you very shortly, by phone or by email.',
      '« {texte} »': '“{texte}”', 'Référence copiée': 'Reference copied', 'Copier la référence': 'Copy the reference',
      // Recrutement
      'Merci de compléter les champs indiqués en rouge.': 'Please complete the fields marked in red.',
      'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous au 06 11 67 86 25.': 'Sending failed. Check your connection and try again, or call us on +33 6 11 67 86 25.',
      'Agent de sécurité': 'Security officer', 'Garde du corps (protection rapprochée)': 'Bodyguard (close protection)', 'Chauffeur privé (VTC)': 'Private chauffeur (VTC)',
      'Sécurité privée': 'Private security', 'Chauffeur privé': 'Private chauffeur', 'Chauffeur + sécurité': 'Chauffeur + security', 'Autre': 'Other',
      // Avis
      '{n} avis publié': '{n} published review', '{n} avis publiés': '{n} published reviews',
      'Aucun avis publié pour le moment': 'No reviews published yet', '{n} sur 5': '{n} out of 5',
      'Avis momentanément indisponibles, réessayez dans un instant.': 'Reviews temporarily unavailable, please try again in a moment.',
      'Décevant': 'Disappointing', 'Moyen': 'Average', 'Bien': 'Good', 'Très bien': 'Very good', 'Excellent !': 'Excellent!',
      'L\'envoi a échoué. Vérifiez votre connexion et réessayez.': 'Sending failed. Check your connection and try again.',
      '{m}/5 · {n} avis client': '{m}/5 · {n} client review', '{m}/5 · {n} avis clients': '{m}/5 · {n} client reviews',
      // Tarifs
      'SSIAP 1': 'SSIAP 1', 'SSIAP 2': 'SSIAP 2', 'SSIAP 3': 'SSIAP 3', '{nom} · {prix} HT/h': '{nom} · {prix} excl. VAT/h',
      'De nuit (+{n} %)': 'At night (+{n}%)', 'Un dimanche (+{n} %)': 'On a Sunday (+{n}%)', 'Un jour férié (+{n} %)': 'On a public holiday (+{n}%)',
      // Entreprises
      'Indiquez le nom de votre société.': 'Please enter your company name.', 'Indiquez votre nom et prénom.': 'Please enter your full name.',
      'Indiquez une adresse e-mail valide.': 'Please enter a valid email address.', 'Choisissez le type d’établissement.': 'Please choose the type of premises.',
      'Indiquez la ville ou le code postal du site.': 'Please enter the city or postcode of the site.', 'Choisissez le type de mission.': 'Please choose the type of assignment.',
    },
    ar: {
      'Mon compte': 'حسابي', 'Espace client': 'بوابة العملاء', 'Espace agent': 'بوابة الفريق',
      'Devis, factures, missions': 'عروض الأسعار، الفواتير، المهام', 'Planning, pointage, documents': 'الجدول، تسجيل الحضور، الوثائق',
      'Fermer': 'إغلاق', 'Bientôt': 'قريبًا',
      'Cette option n’est pas encore disponible': 'هذا الخيار غير متاح بعد',
      'La réservation de VTC en ligne arrive très bientôt. En attendant, notre équipe vous répond directement.': 'حجز السائق عبر الإنترنت قادم قريبًا جدًا. وفي الأثناء، يرد عليكم فريقنا مباشرة.',
      'Demander un devis': 'اطلبوا عرض سعر', 'Fermé': 'مغلق',
      'Demandes en ligne momentanément fermées': 'الطلبات عبر الإنترنت مغلقة مؤقتًا',
      'Pour un devis, appelez-nous ou écrivez-nous sur WhatsApp : nous vous répondons rapidement.': 'للحصول على عرض سعر، اتصلوا بنا أو راسلونا عبر واتساب: سنرد عليكم بسرعة.',
      'Les candidatures sont fermées pour le moment': 'باب الترشّح مغلق حاليًا',
      'Merci de votre intérêt pour BDA Security Group. Revenez bientôt : nos prochains postes seront publiés ici.': 'شكرًا لاهتمامكم بـ BDA Security Group. عودوا قريبًا: ستُنشر مناصبنا القادمة هنا.',
      'Le dépôt d’avis est momentanément fermé': 'إضافة الآراء متوقفة مؤقتًا',
      'Merci de votre confiance ! Vous pouvez toujours lire les avis de nos clients sur cette page.': 'شكرًا على ثقتكم! يمكنكم دائمًا قراءة آراء عملائنا في هذه الصفحة.',
      'Page indisponible': 'الصفحة غير متاحة', 'Cette page n’est pas disponible pour le moment.': 'هذه الصفحة غير متاحة حاليًا.',
      'Notre équipe reste joignable 24h/24 pour répondre à votre demande.': 'يبقى فريقنا متاحًا على مدار الساعة للرد على طلبكم.',
      'Retour à l’accueil': 'العودة إلى الصفحة الرئيسية',
      'Indiquez votre nom.': 'يرجى إدخال اسمكم.', 'Indiquez un numéro de téléphone valide.': 'يرجى إدخال رقم هاتف صحيح.',
      'Choisissez un jour et un moment.': 'يرجى اختيار اليوم والفترة.',
      'le matin (9h – 12h)': 'صباحًا (9 – 12)', 'le midi (12h – 14h)': 'وقت الظهيرة (12 – 14)',
      'l’après-midi (14h – 18h)': 'بعد الظهر (14 – 18)', 'en soirée (18h – 21h)': 'مساءً (18 – 21)',
      'matin, 9h – 12h': 'صباحًا، 9 – 12', 'midi, 12h – 14h': 'الظهيرة، 12 – 14',
      'après-midi, 14h – 18h': 'بعد الظهر، 14 – 18', 'soirée, 18h – 21h': 'مساءً، 18 – 21',
      'dès que possible': 'في أقرب وقت ممكن',
      'Un responsable vous rappelle {quand} au {tel}.': 'سيتصل بكم أحد المسؤولين {quand} على الرقم {tel}.',
      'Envoi impossible pour le moment.': 'تعذّر الإرسال حاليًا.',
      'Vous pouvez aussi nous appeler au 06 11 67 86 25.': 'يمكنكم أيضًا الاتصال بنا على الرقم ‎+33 6 11 67 86 25‎.',
      'Ex. : lieu de la mission, dates et horaires, nombre d\'agents souhaité, type d\'événement, nombre d\'invités…': 'مثال: مكان المهمة، التواريخ والمواعيد، عدد الأعوان المطلوب، نوع الفعالية، عدد الضيوف…',
      'Ex. : adresse de départ et d\'arrivée, heure de prise en charge, nombre de passagers et de bagages, numéro de vol ou de train…': 'مثال: عنوان الانطلاق والوصول، ساعة الانطلاق، عدد الركاب والأمتعة، رقم الرحلة الجوية أو القطار…',
      'Ex. : programme de la journée ou de la soirée, lieux, nombre de personnes à accompagner, niveau de discrétion souhaité…': 'مثال: برنامج اليوم أو السهرة، الأماكن، عدد الأشخاص المرافَقين، مستوى التكتّم المطلوب…',
      'Choisissez une prestation pour continuer.': 'اختاروا خدمة للمتابعة.',
      'Merci de cocher la case d\'accord pour envoyer votre demande.': 'يرجى تحديد خانة الموافقة لإرسال طلبكم.',
      'Étape {n} sur {t}': 'الخطوة {n} من {t}',
      'Le formulaire doit d\'abord être activé : cliquez sur « Activate Form » dans l\'email reçu de FormSubmit, puis renvoyez la demande.': 'يجب تفعيل الاستمارة أولًا. يرجى المحاولة لاحقًا أو الاتصال بنا.',
      'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous directement.': 'فشل الإرسال. تحقّقوا من اتصالكم وأعيدوا المحاولة، أو اتصلوا بنا مباشرة.',
      'Gardiennage & surveillance de site': 'حراسة ومراقبة المواقع', 'Protection rapprochée': 'الحماية الشخصية',
      'Sécurité événementielle': 'تأمين الفعاليات', 'Trajet simple': 'رحلة بسيطة', 'Chauffeur à disposition': 'سائق تحت تصرّفكم',
      'Chauffeur + agent de sécurité': 'سائق + حارس أمن', 'Autre demande': 'طلب آخر',
      'Merci, {nom} !': 'شكرًا، {nom}!',
      ' pour le {date}': ' ليوم {date}', ' à {heure}': ' على الساعة {heure}',
      'Votre demande de devis {prestation}{quand} a bien été transmise à notre équipe. Nous l\'étudions et revenons vers vous très rapidement, par téléphone ou par email.': 'تم إرسال طلب عرض السعر {prestation}{quand} إلى فريقنا. ندرسه الآن وسنعود إليكم في أقرب وقت، بالهاتف أو بالبريد الإلكتروني.',
      '« {texte} »': '«{texte}»', 'Référence copiée': 'تم نسخ المرجع', 'Copier la référence': 'نسخ المرجع',
      'Merci de compléter les champs indiqués en rouge.': 'يرجى إكمال الحقول المشار إليها باللون الأحمر.',
      'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous au 06 11 67 86 25.': 'فشل الإرسال. تحقّقوا من اتصالكم وأعيدوا المحاولة، أو اتصلوا بنا على الرقم ‎+33 6 11 67 86 25‎.',
      'Agent de sécurité': 'حارس أمن', 'Garde du corps (protection rapprochée)': 'حارس شخصي (حماية شخصية)', 'Chauffeur privé (VTC)': 'سائق خاص (VTC)',
      'Sécurité privée': 'الأمن الخاص', 'Chauffeur privé': 'السائق الخاص', 'Chauffeur + sécurité': 'سائق + حماية', 'Autre': 'غير ذلك',
      '{n} avis publié': 'رأي واحد منشور', '{n} avis publiés': '{n} آراء منشورة',
      'Aucun avis publié pour le moment': 'لم يُنشر أي رأي بعد', '{n} sur 5': '{n} من 5',
      'Avis momentanément indisponibles, réessayez dans un instant.': 'الآراء غير متاحة مؤقتًا، أعيدوا المحاولة بعد لحظات.',
      'Décevant': 'مخيّب', 'Moyen': 'متوسط', 'Bien': 'جيد', 'Très bien': 'جيد جدًا', 'Excellent !': 'ممتاز!',
      'L\'envoi a échoué. Vérifiez votre connexion et réessayez.': 'فشل الإرسال. تحقّقوا من اتصالكم وأعيدوا المحاولة.',
      '{m}/5 · {n} avis client': '{m}/5 · رأي عميل واحد', '{m}/5 · {n} avis clients': '{m}/5 · {n} من آراء العملاء',
      'SSIAP 1': 'SSIAP 1', 'SSIAP 2': 'SSIAP 2', 'SSIAP 3': 'SSIAP 3', '{nom} · {prix} HT/h': '{nom} · {prix} دون ضريبة/الساعة',
      'De nuit (+{n} %)': 'ليلًا (+{n}%)', 'Un dimanche (+{n} %)': 'يوم أحد (+{n}%)', 'Un jour férié (+{n} %)': 'يوم عطلة رسمية (+{n}%)',
      'Indiquez le nom de votre société.': 'يرجى إدخال اسم شركتكم.', 'Indiquez votre nom et prénom.': 'يرجى إدخال اسمكم الكامل.',
      'Indiquez une adresse e-mail valide.': 'يرجى إدخال عنوان بريد إلكتروني صحيح.', 'Choisissez le type d’établissement.': 'يرجى اختيار نوع المنشأة.',
      'Indiquez la ville ou le code postal du site.': 'يرجى إدخال المدينة أو الرمز البريدي للموقع.', 'Choisissez le type de mission.': 'يرجى اختيار نوع المهمة.',
    },
  };
  const dico = D[L] || {};
  window.LANGUE = L;
  // Dates et nombres : chiffres occidentaux aussi en arabe
  window.LOCALE = { en: 'en-GB', ar: 'ar-u-nu-latn' }[L] || 'fr-FR';
  window.T = (fr, v) => {
    let s = Object.prototype.hasOwnProperty.call(dico, fr) ? dico[fr] : fr;
    if (v) s = s.replace(/\{(\w+)\}/g, (_, k) => (v[k] === undefined ? '' : v[k]));
    return s;
  };
})();
