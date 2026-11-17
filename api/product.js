// Vercel function: GET /api/product?id=<24-hex product id>
// Looks up a product on the main website's backend and returns only its name and price.
// - Only logged-in ERP users can call it (Firebase ID token verified against Google's keys).
// - Only one fixed backend is ever called, and the id must be a 24-char hex id,
//   so this cannot be used to fetch arbitrary URLs.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID = 'peopleandstyle-erp';
const PRODUCT_API_URL = (process.env.PRODUCT_API_URL || 'https://rental-website-6a9i.vercel.app').replace(/\/+$/, '');

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function isLoggedIn(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  try {
    await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const id = new URL(req.url, 'http://localhost').searchParams.get('id') || '';
  if (!/^[a-f0-9]{24}$/i.test(id)) return send(res, 400, { error: 'Not a valid product link' });

  if (!(await isLoggedIn(req))) return send(res, 401, { error: 'Please log in again' });

  try {
    const upstream = await fetch(`${PRODUCT_API_URL}/api/products/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (upstream.status === 404) return send(res, 404, { error: 'Product not found on the website' });
    if (!upstream.ok) return send(res, 502, { error: 'Website did not respond, try again' });

    const product = await upstream.json();
    const price = Number(product.price) || Number(product.salePrice) || Number(product.rentPrice) || 0;
    return send(res, 200, {
      id,
      name: String(product.name || '').trim(),
      price,
      listingType: product.listingType || null,
    });
  } catch {
    return send(res, 502, { error: 'Website did not respond, try again' });
  }
}
