/* @refresh reload */
import { render } from 'solid-js/web';
import Edit from './pages/Edit';
import './css/app.css';

const root = document.getElementById('pillar-editor-root');

if (!root) throw new Error('#pillar-editor-root is missing from the page');

render(() => <Edit />, root);
