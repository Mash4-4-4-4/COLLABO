import React from 'react'
import {Routes,Route} from "react-router-dom"
import HomePage from './component/HomePage'
import EditorPage from './component/EditorPage'
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/editor/:roomId" element={<EditorPage/>}/>

    </Routes>
  )
}

export default App