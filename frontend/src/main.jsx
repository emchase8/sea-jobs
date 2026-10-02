import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import UserInfoProvider from './userInfo/userInfoProvider.tsx'
// import "bootstrap/dist/css/bootstrap.min.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserInfoProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UserInfoProvider>
  </StrictMode>,
)
