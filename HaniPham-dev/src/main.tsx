import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import './style.css';import './typography.css';import './refinement.css';import './themes.css';import {readTheme} from './useTheme';document.documentElement.dataset.theme=readTheme();ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);


