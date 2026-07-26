import { google } from "googleapis";
import type { GoogleDriveSettings } from "../../config/google-drive-settings";

export function createGoogleOAuthClient(settings: GoogleDriveSettings) {
  const client = new google.auth.OAuth2(settings.clientId, settings.clientSecret,
    "http://localhost:53682/oauth2/callback");
  client.setCredentials({ refresh_token: settings.refreshToken });
  return client;
}
