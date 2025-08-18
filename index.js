/**
 * React Native Entry Point
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './src/native/App.native';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);