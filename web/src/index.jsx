import { render } from 'preact';
import './platform';
import { App } from './app';
import '../../extension/src/styles/variables.css';
import '../../extension/src/styles/global.css';
import '../../extension/src/styles/layout.css';

render(<App />, document.getElementById('app'));
