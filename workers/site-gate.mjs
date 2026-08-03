import { handleSiteRequest } from './site-gate-core.mjs';

export default {
  fetch(request, env) {
    return handleSiteRequest(request, env);
  },
};
