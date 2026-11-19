const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_INVOKE = new Set([
  'app:sources',
  'app:allSources',
  'app:contents',
  'app:search',
  'app:openExternal',
  'app:reveal',
  'app:playlistRefresh',
  'app:minimize',
  'app:close',
  'settings:get',
  'settings:set',
  'library:list',
  'library:download',
  'library:upload',
  'library:remove',
  'workshop:submit',
  'workshop:report',
  'favorites:list',
  'favorites:toggle',
  'wallpaper:apply',
  'wallpaper:stop',
  'wallpaper:status',
  'wallpaper:discardPreview',
  'update:status',
  'update:check',
  'update:install',
]);

const ALLOWED_EVENTS = new Set([
  'evt:wallpaper',
  'wallpaper:show',
  'wallpaper:settings',
  'wallpaper:parallax',
  'wallpaper:event',
  'update:event',
]);

contextBridge.exposeInMainWorld('wallflow', {
  invoke(channel, payload) {
    if (!ALLOWED_INVOKE.has(channel)) return Promise.reject(new Error('Blocked: ' + channel));
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel, callback) {
    if (!ALLOWED_EVENTS.has(channel)) return () => {};
    const handler = (_e, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
