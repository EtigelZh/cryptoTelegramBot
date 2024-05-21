export const GS_CREDENTIALS = {
  "type": "service_account",
  "project_id": "crypto-investing-414008",
  "private_key_id": process.env.GOOGLE_SHEET_PRIVET_KEY_ID,
  "private_key": process.env.GOOGLE_SHEET_PRIVET_KEY,
  "client_email": process.env.GOOGLE_SHEET_SERVICE_ACCOUNT_EMAIL || "sheet-user@crypto-investing-414008.iam.gserviceaccount.com",
  "client_id": "105811597023091522310",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/sheet-user%40crypto-investing-414008.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
