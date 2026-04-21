// Legacy CRA entrypoint (kept for compatibility with older bootstrap code).
// Production uses Next.js app router under src/app/*.
// Deliberately minimal — all real routes and UI live in src/app/*.
import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  useEffect(() => {
    axios.get(`${API}/`).catch(() => { /* noop */ });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#010104", color: "#F0F0F5" }}>
      <div className="text-center">
        <div className="text-[10px] tracking-[0.3em] text-[#00E5FF]">UNIFY</div>
        <h1 className="text-4xl font-black tracking-tighter mt-2">Apply where you can win.</h1>
        <p className="text-sm text-white/60 mt-2">Adaptive placement intelligence.</p>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
