import { render } from 'preact';
import './platform/extension';
import { App } from './app';
import './styles/variables.css';
import './styles/global.css';

render(<App />, document.getElementById('app'));
