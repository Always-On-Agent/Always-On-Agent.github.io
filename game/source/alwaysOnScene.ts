/** Each scene owns its world and browser memory; switching starts a new visit. */
const scene = new URLSearchParams(location.search).get('scene')
// Old shared village links now open the replacement campus experience.
export const isSingaporeScene = ['singapore', 'ntu', 'village'].includes(scene ?? '')
export const isEccvScene = !isSingaporeScene
