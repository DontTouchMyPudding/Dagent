import { createBrowserRouter, Navigate } from "react-router-dom";
import ChatPage from "../pages/ChatPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/chat",
    element: <ChatPage />,
  },
  {
    path: "/chat/:sessionId",
    element: <ChatPage />,
  },
]);


export default router