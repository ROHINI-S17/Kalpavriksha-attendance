import { useState, useEffect, useRef } from 'react'
import { studentsAPI, attendanceAPI } from '../services/api'
import { Camera, Upload, CheckCircle2, Loader2, UserCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
// face-api loaded from CDN via index.html
const faceapi = window.faceapi

const MODEL_URL = '/models'

export default function FaceAttendance() {
  const [mode, setMode] = useState('scan') // 'scan' | 'register'
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [students, setStudents] = useState([])
  const [knownFaces, setKnownFaces] = useState([])
  const [markedStudents, setMarkedStudents] = useState([])
  const [scanning, setScanning] = useState(false)
  const [registerStudent, setRegisterStudent] = useState('')
  const [saving, setSaving] = useState(false)
  const [subject, setSubject] = useState('General')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        setModelsLoaded(true)
        toast.success('Face recognition ready!')
      } catch (e) {
        toast.error('Failed to load face models')
      }
    }
    loadModels()
    studentsAPI.list({}).then(r => setStudents(r.data))
    return () => stopCamera()
  }, [])

  // Load known faces from backend
  const loadKnownFaces = async () => {
    try {
      const res = await fetch('/api/students/faces', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      })
      const data = await res.json()
      const labeledDescriptors = []
      for (const s of data) {
        try {
          const img = await faceapi.fetchImage(s.face_path)
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceDescriptor()
          if (detection) {
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(
                `${s.student_id}|${s.name}`,
                [detection.descriptor]
              )
            )
          }
        } catch {}
      }
      setKnownFaces(labeledDescriptors)
      return labeledDescriptors
    } catch {
      toast.error('Failed to load student faces')
      return []
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      toast.error('Camera access denied. Please allow camera.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setScanning(false)
  }

  const startScanning = async () => {
    if (!modelsLoaded) return toast.error('Models still loading...')
    setScanning(true)
    await startCamera()
    const faces = knownFaces.length > 0 ? knownFaces : await loadKnownFaces()
    if (faces.length === 0) {
      toast.error('No student faces registered yet! Register faces first.')
      stopCamera()
      return
    }
    const matcher = new faceapi.FaceMatcher(faces, 0.5)
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptors()
      if (canvasRef.current && videoRef.current) {
        const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }
        faceapi.matchDimensions(canvasRef.current, dims)
        const resized = faceapi.resizeResults(detections, dims)
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, dims.width, dims.height)
        resized.forEach(d => {
          const match = matcher.findBestMatch(d.descriptor)
          const label = match.label !== 'unknown' ? match.label.split('|')[1] : 'Unknown'
          const color = match.label !== 'unknown' ? '#22c55e' : '#ef4444'
          const box = d.detection.box
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.strokeRect(box.x, box.y, box.width, box.height)
          ctx.fillStyle = color
          ctx.font = '14px Inter'
          ctx.fillText(label, box.x, box.y - 5)
          if (match.label !== 'unknown') {
            const sid = match.label.split('|')[0]
            setMarkedStudents(prev => {
              if (!prev.find(s => s.student_id === sid)) {
                toast.success(`Marked: ${label}`, { duration: 2000 })
                return [...prev, { student_id: sid, name: label }]
              }
              return prev
            })
          }
        })
      }
    }, 500)
  }

  const saveAttendance = async () => {
    if (markedStudents.length === 0) return toast.error('No students detected yet!')
    setSaving(true)
    try {
      const records = markedStudents.map(s => ({
        student_id: s.student_id,
        status: 'present',
        date: format(new Date(), 'yyyy-MM-dd'),
        subject,
      }))
      await attendanceAPI.mark(records)
      toast.success(`Saved! ${markedStudents.length} students marked present`)
      stopCamera()
      setMarkedStudents([])
    } catch {
      toast.error('Failed to save attendance')
    } finally {
      setSaving(false) }
  }

  // Register face from uploaded photo
  const handleRegisterFace = async (e) => {
    const file = e.target.files[0]
    if (!file || !registerStudent) return toast.error('Select a student first')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result
      const student = students.find(s => s.student_id === registerStudent)
      if (!student) return
      try {
        const res = await fetch(`/api/students/${student.id}/upload-face`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ image: base64 }),
        })
        const data = await res.json()
        toast.success(`Face registered for ${data.student}!`)
        setKnownFaces([]) // reset so they reload next scan
      } catch {
        toast.error('Failed to register face')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Header tabs */}
      <div className="flex gap-3">
        <button onClick={() => { stopCamera(); setMode('scan') }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'scan' ? 'bg-blue-600 text-white' : 'btn-secondary'}`}>
          <Camera size={14} className="inline mr-2" />Scan Attendance
        </button>
        <button onClick={() => { stopCamera(); setMode('register') }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'register' ? 'bg-blue-600 text-white' : 'btn-secondary'}`}>
          <Upload size={14} className="inline mr-2" />Register Faces
        </button>
      </div>

      {/* Models loading indicator */}
      {!modelsLoaded && (
        <div className="card p-4 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-blue-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading face recognition models... (first time takes ~30 seconds)</span>
        </div>
      )}

      {/* SCAN MODE */}
      {mode === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select className="input w-40" value={subject} onChange={e => setSubject(e.target.value)}>
                {['General','Mathematics','Science','English','Computer Science'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {!scanning
                ? <button onClick={startScanning} disabled={!modelsLoaded} className="btn-primary flex items-center gap-2">
                    <Camera size={14} />Start Camera
                  </button>
                : <button onClick={stopCamera} className="btn-danger flex items-center gap-2">
                    <X size={14} />Stop Camera
                  </button>
              }
              {markedStudents.length > 0 && (
                <button onClick={saveAttendance} disabled={saving} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Save ({markedStudents.length})
                </button>
              )}
            </div>
            {/* Camera view */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: 320 }}>
              <video ref={videoRef} className="w-full rounded-xl" autoPlay muted playsInline />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Camera size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Click Start Camera to begin</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Marked students list */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <UserCheck size={16} className="text-green-500" />
              Detected ({markedStudents.length})
            </h3>
            {markedStudents.length === 0
              ? <p className="text-xs text-gray-400 text-center mt-8">Students will appear here as they are detected</p>
              : <div className="space-y-2">
                  {markedStudents.map(s => (
                    <div key={s.student_id} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.student_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* REGISTER MODE */}
      {mode === 'register' && (
        <div className="card p-6 max-w-lg">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Register student face photo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Select Student</label>
              <select className="input" value={registerStudent} onChange={e => setRegisterStudent(e.target.value)}>
                <option value="">-- Choose student --</option>
                {students.map(s => (
                  <option key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Upload Clear Face Photo</label>
              <label className={`flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${registerStudent ? 'border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950' : 'border-gray-200 opacity-50 cursor-not-allowed'}`}>
                <Upload size={24} className="text-gray-400" />
                <span className="text-sm text-gray-500">Click to upload photo</span>
                <span className="text-xs text-gray-400">Clear front-facing photo works best</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleRegisterFace} disabled={!registerStudent} />
              </label>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">Tips for best results with kids:</p>
              <p>• Use a clear, well-lit front-facing photo</p>
              <p>• One face per photo only</p>
              <p>• School ID photo or passport size works great</p>
              <p>• Register all students before scanning</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}