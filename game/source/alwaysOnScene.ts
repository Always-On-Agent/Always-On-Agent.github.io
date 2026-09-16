/** Each scene owns its world and browser memory; switching starts a new visit. */
export const isEccvScene = new URLSearchParams(location.search).get('scene') === 'eccv'
