import React from 'react'
import {Routes,Route,useParams} from "react-router-dom"
import HomePage from './component/HomePage'
import EditorPage from './component/EditorPage'
function KeyedEditorPage() {
  const { roomId } = useParams()
  return <EditorPage key={roomId} />
}
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/editor/:roomId" element={<KeyedEditorPage/>}/>

    </Routes>
  )
}

export default App