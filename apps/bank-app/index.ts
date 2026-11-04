import { createElement } from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import { HardeningGate } from './src/hardening/HardeningGate';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
// The gate does nothing in a demo build; in a production build it applies the mobile hardening (docs/SECURITY.md).
registerRootComponent(() => createElement(HardeningGate, null, createElement(App)));
