// scripts/update-config.ts
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const envVars = {
  API_KEY: process.env.API_KEY,
  GCM_SENDER_ID: process.env.GCM_SENDER_ID,
  PROJECT_ID: process.env.PROJECT_ID,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  GOOGLE_APP_ID: process.env.GOOGLE_APP_ID,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
};

['./google-services.json', './GoogleService-Info.plist'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  for (const [key, value] of Object.entries(envVars)) {
    if (value) content = content.replace(new RegExp(`\\\${${key}}`, 'g'), value);
  }
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});