// email-alerts.js
(function() {
    // Initialize EmailJS
    emailjs.init("IFqPN0jGwpP4v4O1R");
})();

// Track alerts sent in the current session to prevent race conditions
const sentInSession = new Set();
let isChecking = false;

/**
 * Checks all documents for expiry and sends an EmailJS alert
 * if a document expires exactly in 7 days.
 */
window.checkExpiryAlerts = async function() {
    // Prevent overlapping checks
    if (isChecking) return;
    if (!window.fb || !window.fb.auth.currentUser || !window.documents) return;

    isChecking = true;
    const uid = window.fb.auth.currentUser.uid;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    try {
        for (const doc of window.documents) {
            if ((doc.docType === 'employee' || doc.docType === 'company') && doc.expiryDate) {
                const expiry = new Date(doc.expiryDate);
                expiry.setHours(0, 0, 0, 0);

                const diffTime = expiry - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // If it expires exactly in 7 days
                if (diffDays === 7) {
                    const historyKey = `${doc.id}_${todayString}`;

                    // Check if already sent in this session or already processing
                    if (sentInSession.has(historyKey)) continue;

                    // Check Firestore history
                    const historyRef = window.fb.doc(window.fb.db, `users/${uid}/emailHistory`, historyKey);
                    const historySnap = await window.fb.getDoc(historyRef);

                    if (!historySnap.exists()) {
                        // Mark as sent LOCALLY immediately to prevent duplicates from rapid calls
                        sentInSession.add(historyKey);

                        const isCompany = doc.docType === 'company';
                        const templateParams = {
                            title: isCompany ? "Company Document Expiry Alert" : "Employee Document Expiry Alert",
                            name_label: isCompany ? "Company/Owner Name" : "Employee Name",
                            name: doc.personName || "Unknown",
                            document: doc.docName || "Unknown Document",
                            date: doc.expiryDate || "Unknown Date"
                        };

                        console.log("Sending expiry alert for:", doc.personName);
                        
                        try {
                            const response = await emailjs.send("service_qhydvmg", "template_nujoom_alert", templateParams);
                            console.log('Email alert sent successfully!', response.status, response.text);
                            
                            // Record in Firestore so we don't send again tomorrow or on refresh
                            await window.fb.setDoc(historyRef, { 
                                docId: doc.id,
                                sentAt: Date.now(),
                                dateString: todayString
                            });
                        } catch (error) {
                            console.error('Failed to send email alert...', error);
                            // If it failed, remove from local set so we can try again later
                            sentInSession.delete(historyKey);
                        }
                    } else {
                        // Already in Firestore, mark locally so we don't check again
                        sentInSession.add(historyKey);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error during email expiry checks: ", e);
    } finally {
        isChecking = false;
    }
};