// Single hardcoded admin account. Must stay in sync with the isAdmin()
// check in firestore.rules — that's the actual security boundary; this
// constant only controls whether the UI is shown.
export const ADMIN_USERNAME = "birkleyg";
