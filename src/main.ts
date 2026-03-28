/**
 * WebSerialMonitor - Application Entry Point
 *
 * Checks for Web Serial API support and Secure Context,
 * then bootstraps the application.
 */

function checkSecureContext(): boolean {
  return window.isSecureContext;
}

function isWebSerialSupported(): boolean {
  return 'serial' in navigator;
}

function showUnsupportedDialog(message: string): void {
  const dialog = document.createElement('div');
  dialog.className = 'unsupported-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'unsupported-title');

  const box = document.createElement('div');
  box.className = 'unsupported-dialog__box';

  const title = document.createElement('h1');
  title.className = 'unsupported-dialog__title';
  title.id = 'unsupported-title';
  title.textContent = 'WebSerialMonitor が利用できません';

  const msg = document.createElement('p');
  msg.className = 'unsupported-dialog__message';
  msg.textContent = message;

  const browsers = document.createElement('p');
  browsers.className = 'unsupported-dialog__browsers';
  browsers.textContent =
    '対応ブラウザ: Google Chrome 89+, Microsoft Edge 89+, Opera 75+';
  browsers.appendChild(document.createElement('br'));
  browsers.appendChild(
    document.createTextNode('※ HTTPS または localhost 上でのみ動作します')
  );

  box.append(title, msg, browsers);
  dialog.appendChild(box);
  document.body.appendChild(dialog);
}

async function bootstrap(): Promise<void> {
  if (!checkSecureContext()) {
    showUnsupportedDialog(
      'Web Serial API は Secure Context（HTTPS または localhost）でのみ利用できます。' +
      'HTTPS 経由でアクセスしてください。'
    );
    return;
  }

  if (!isWebSerialSupported()) {
    showUnsupportedDialog(
      'お使いのブラウザは Web Serial API に対応していません。' +
      'Google Chrome または Microsoft Edge の最新版をお使いください。'
    );
    return;
  }

  // Web Serial API supported – dynamically import the App to keep
  // the unsupported-browser path lightweight.
  const { App } = await import('./presentation/App.js');
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    console.error('[main] #app element not found');
    return;
  }
  const app = new App(appRoot);
  app.mount();
}

bootstrap().catch((err: unknown) => {
  console.error('[main] Failed to bootstrap application:', err);
});
