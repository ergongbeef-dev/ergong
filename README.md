# 貳恭 ER GONG — brand website preview

Adapted from the user-supplied `index_1.html`, preserving the orange/black comic visual direction, brand character, SVG package art, product descriptions, prices and contact links. Replaces the initial MORI example within the same Site identity.

The authored static entrypoint is `dist/index.html`, with `dist/style.css` and `dist/app.js`. No installation or build is required.

Includes homepage, product catalog, categories, search, favorites, variants, stock-aware cart, shipping-cost calculation, delivery-form preview, order-detail preview, brand/about content and a local admin-interface demonstration.

Products, settings, cart and favorites save only in the current browser via localStorage. They do not change canonical Site source or sync between customers. Trial delivery information and trial orders remain in memory and are cleared by reload. The preview passcode from the supplied artifact is a UI demonstration, not real authentication. The Site itself remains restricted by Sites owner-only access.

No real orders, email, payment, inventory reservation, logistics, shared database or production admin authentication are connected. The UI explicitly labels these limits. A future commerce backend must implement server-side authorization, authoritative product/pricing/stock validation, durable orders and actual provider integrations before accepting real purchases.

All product claims and contact URLs originate in the supplied file; no new real stock or packaging photos were invented.
