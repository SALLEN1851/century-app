import { prisma } from "@/lib/prisma";

// Base WHOOP API URL
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';

/**
 * Fetch data from WHOOP API with automatic token refresh
 * @param {string} userId - The user ID from session
 * @param {string} endpoint - The WHOOP API endpoint (e.g., '/cycles', '/recovery')
 * @returns {Promise<Object>} The API response data
 */
export async function fetchWhoopData(userId, endpoint) {
  // Get the user's WHOOP account
  const account = await prisma.account.findFirst({
    where: {
      userId: userId,
      provider: "whoop"
    }
  });

  if (!account || !account.access_token) {
    throw new Error("WHOOP account not connected");
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  let accessToken = account.access_token;
  
  if (account.expires_at && account.expires_at < now) {
    // Token expired, refresh it
    const refreshedTokens = await refreshWhoopToken(account);
    if (!refreshedTokens) {
      throw new Error("Failed to refresh WHOOP token");
    }
    accessToken = refreshedTokens.access_token;
  }

  // Make the API request
  const response = await fetch(`${WHOOP_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`WHOOP API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Refresh WHOOP OAuth token
 * @param {Object} account - The account object from database
 * @returns {Promise<Object|null>} Updated account or null if failed
 */
async function refreshWhoopToken(account) {
  try {
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh WHOOP token');
      return null;
    }

    const tokens = await response.json();

    // Update tokens in database
    const updatedAccount = await prisma.account.update({
      where: {
        id: account.id
      },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || account.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      }
    });

    return updatedAccount;
  } catch (error) {
    console.error('Error refreshing WHOOP token:', error);
    return null;
  }
}

// Specific WHOOP data fetching functions
export async function getWhoopCycles(userId, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWhoopData(userId, `/cycles${query}`);
}

export async function getWhoopRecovery(userId, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWhoopData(userId, `/recovery${query}`);
}

export async function getWhoopSleep(userId, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWhoopData(userId, `/sleep${query}`);
}

export async function getWhoopWorkouts(userId, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWhoopData(userId, `/workouts${query}`);
}

export async function getWhoopProfile(userId) {
  return fetchWhoopData(userId, '/user/profile/basic');
}