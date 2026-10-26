import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Mic, Speaker, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const SINGLE_CHANNEL_DURATION_MS = 1200
const BOTH_CHANNELS_SEGMENT_MS = 1e3
const MIC_LEVEL_UPDATE_MS = 66

export function AudioModule() {
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)
  const [micLevel, setMicLevel] = useState(0)
  const lastMicUpdateRef = useRef(0)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const [outputDevices, setOutputDevices] = useState([])
  const [selectedOutputId, setSelectedOutputId] = useState('default')
  const [videoDevices, setVideoDevices] = useState([])
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState('')
  const [playingChannel, setPlayingChannel] = useState(null)
  const [speakerError, setSpeakerError] = useState(null)
  const speakerAudioContextRef = useRef(null)
  const speakerAudioElRef = useRef(null)
  const speakerStopTimeoutRef = useRef(null)
  const stopAll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    analyserRef.current = null
    setMicLevel(0)
    setStatus('idle')
  }, [])
  const loadDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const outputs = devices
        .filter((device) => device.kind === 'audiooutput')
        .map((device, index2) => ({
          deviceId: device.deviceId,
          label: device.label || `Audio output ${index2 + 1}`
        }))
      setOutputDevices(outputs)
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index2) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index2 + 1}`
        }))
      setVideoDevices(cameras)
      setSelectedVideoDeviceId((prev) => prev || cameras[0]?.deviceId || '')
    } catch {
      setOutputDevices([])
      setVideoDevices([])
    }
  }, [])
  useEffect(() => {
    void loadDevices()
    navigator.mediaDevices.addEventListener('devicechange', loadDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
    }
  }, [loadDevices])
  const startTest = useCallback(async () => {
    setStatus('requesting')
    setErrorMessage(null)
    try {
      let tick = function () {
        const currentAnalyser = analyserRef.current
        if (!currentAnalyser) return
        currentAnalyser.getByteTimeDomainData(data)
        let sumSquares = 0
        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] - 128) / 128
          sumSquares += normalized * normalized
        }
        const rms = Math.sqrt(sumSquares / data.length)
        // Analyse every frame but re-render ~15×/s: updating state at 60 fps
        // re-rendered the whole module (video preview included) constantly.
        const now = performance.now()
        if (now - lastMicUpdateRef.current >= MIC_LEVEL_UPDATE_MS) {
          lastMicUpdateRef.current = now
          setMicLevel(Math.round(Math.min(1, rms * 4) * 100) / 100)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      const videoConstraint = selectedVideoDeviceId
        ? {
            deviceId: {
              exact: selectedVideoDeviceId
            }
          }
        : true
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: true
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => void 0)
      }
      void loadDevices()
      if (!selectedVideoDeviceId) {
        const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId
        if (activeDeviceId) setSelectedVideoDeviceId(activeDeviceId)
      }
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      tick()
      setStatus('active')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not access the camera or microphone'
      )
      setStatus('error')
    }
  }, [selectedVideoDeviceId, loadDevices])
  useEffect(() => stopAll, [stopAll])
  const switchCamera = useCallback(
    async (deviceId) => {
      setSelectedVideoDeviceId(deviceId)
      if (status !== 'active' || !streamRef.current) return
      try {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: {
              exact: deviceId
            }
          }
        })
        const newTrack = newVideoStream.getVideoTracks()[0]
        if (!newTrack) return
        const stream = streamRef.current
        stream.getVideoTracks().forEach((track) => {
          stream.removeTrack(track)
          track.stop()
        })
        stream.addTrack(newTrack)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => void 0)
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not switch to the selected camera'
        )
      }
    },
    [status]
  )
  const speakerGenerationRef = useRef(0)
  const stopSpeakerTest = useCallback(() => {
    speakerGenerationRef.current += 1
    if (speakerStopTimeoutRef.current !== null) {
      window.clearTimeout(speakerStopTimeoutRef.current)
      speakerStopTimeoutRef.current = null
    }
    void speakerAudioContextRef.current?.close()
    speakerAudioContextRef.current = null
    if (speakerAudioElRef.current) {
      speakerAudioElRef.current.pause()
      speakerAudioElRef.current.srcObject = null
    }
    speakerAudioElRef.current = null
    setPlayingChannel(null)
  }, [])
  useEffect(() => stopSpeakerTest, [stopSpeakerTest])
  const playPannedTone = useCallback(
    async (pan) => {
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 440
      const panner = audioContext.createStereoPanner()
      panner.pan.value = pan
      const destination = audioContext.createMediaStreamDestination()
      oscillator.connect(panner)
      panner.connect(destination)
      const audioEl = new Audio()
      audioEl.srcObject = destination.stream
      if (selectedOutputId !== 'default' && typeof audioEl.setSinkId === 'function') {
        await audioEl.setSinkId(selectedOutputId)
      }
      oscillator.start()
      await audioEl.play().catch(() => void 0)
      return {
        audioContext,
        oscillator,
        audioEl
      }
    },
    [selectedOutputId]
  )
  const playChannelTest = useCallback(
    async (channel) => {
      setSpeakerError(null)
      stopSpeakerTest()
      const generation = speakerGenerationRef.current
      try {
        if (channel === 'both') {
          const left = await playPannedTone(-1)
          if (generation !== speakerGenerationRef.current) {
            left.oscillator.stop()
            void left.audioContext.close()
            return
          }
          speakerAudioContextRef.current = left.audioContext
          speakerAudioElRef.current = left.audioEl
          setPlayingChannel('both')
          speakerStopTimeoutRef.current = window.setTimeout(() => {
            left.oscillator.stop()
            void left.audioContext.close()
            left.audioEl.pause()
            left.audioEl.srcObject = null
            void (async () => {
              try {
                const right = await playPannedTone(1)
                if (generation !== speakerGenerationRef.current) {
                  right.oscillator.stop()
                  void right.audioContext.close()
                  return
                }
                speakerAudioContextRef.current = right.audioContext
                speakerAudioElRef.current = right.audioEl
                speakerStopTimeoutRef.current = window.setTimeout(() => {
                  right.oscillator.stop()
                  stopSpeakerTest()
                }, BOTH_CHANNELS_SEGMENT_MS)
              } catch (err) {
                setSpeakerError(err instanceof Error ? err.message : 'Could not play the test tone')
                setPlayingChannel(null)
              }
            })()
          }, BOTH_CHANNELS_SEGMENT_MS)
          return
        }
        const tone = await playPannedTone(channel === 'left' ? -1 : 1)
        if (generation !== speakerGenerationRef.current) {
          tone.oscillator.stop()
          void tone.audioContext.close()
          return
        }
        speakerAudioContextRef.current = tone.audioContext
        speakerAudioElRef.current = tone.audioEl
        setPlayingChannel(channel)
        speakerStopTimeoutRef.current = window.setTimeout(() => {
          tone.oscillator.stop()
          stopSpeakerTest()
        }, SINGLE_CHANNEL_DURATION_MS)
      } catch (err) {
        setSpeakerError(err instanceof Error ? err.message : 'Could not play the test tone')
        setPlayingChannel(null)
      }
    },
    [playPannedTone, stopSpeakerTest]
  )
  const isActive = status === 'active'
  const levelPercent = Math.round(micLevel * 100)
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Webcam, microphone and speaker test</h1>
        <p className="text-sm text-zinc-500">
          Live preview of what the camera and microphone capture, and plays test tones per channel
          to verify the speakers.
        </p>
      </header>
      {status === 'error' && (
        <Card className="mb-4 border-red-900/50 bg-red-950/40">
          <CardContent className="py-4 text-sm text-red-400">
            {'Could not access the camera or microphone: '}
            {errorMessage}
            {". Check the app's permissions in Windows (Settings → Privacy → Camera/Microphone)."}
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Camera className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Camera</CardTitle>
              <CardDescription>Live preview of the captured video</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-zinc-900">
              <video
                ref={videoRef}
                autoPlay={true}
                muted={true}
                playsInline={true}
                className={cn('h-full w-full -scale-x-100 object-cover', !isActive && 'hidden')}
              />
              {!isActive && (
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <VideoOff className="h-8 w-8" />
                  <span className="text-sm">No video signal</span>
                </div>
              )}
            </div>
            {videoDevices.length > 1 && (
              <div className="mt-3 flex flex-col gap-1">
                <label htmlFor="camera-device" className="text-xs font-medium text-zinc-500">
                  Camera
                </label>
                <select
                  id="camera-device"
                  value={selectedVideoDeviceId}
                  onChange={(event) => void switchCamera(event.target.value)}
                  className="w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
                >
                  {videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Mic className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Microphone</CardTitle>
              <CardDescription>Real-time audio input level</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-center gap-3">
            <div className="h-6 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-100',
                  levelPercent < 60
                    ? 'bg-emerald-500'
                    : levelPercent < 85
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                )}
                style={{
                  width: isActive ? `${levelPercent}%` : '0%'
                }}
              />
            </div>
            <p className="text-xs text-zinc-500">
              {isActive
                ? 'Speak or make a sound near the microphone: the bar should move.'
                : 'Start the test to see the microphone level.'}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          {!isActive ? (
            <Button
              onClick={() => void startTest()}
              disabled={status === 'requesting'}
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              {status === 'requesting' ? 'Requesting access…' : 'Start test'}
            </Button>
          ) : (
            <Button variant="outline" onClick={stopAll} className="gap-2">
              <VideoOff className="h-4 w-4" />
              Stop test
            </Button>
          )}
          <span className="text-xs text-zinc-500">
            Microphone audio is not played through the speakers (only its level is measured), to
            avoid feedback/echo.
          </span>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center gap-2">
          <Speaker className="h-5 w-5 text-zinc-400" />
          <div>
            <CardTitle>Speakers</CardTitle>
            <CardDescription>Plays a test tone per channel to verify the speakers</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {outputDevices.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="output-device" className="text-xs font-medium text-zinc-500">
                Output device
              </label>
              <select
                id="output-device"
                value={selectedOutputId}
                onChange={(event) => setSelectedOutputId(event.target.value)}
                className="w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
              >
                <option value="default">System default</option>
                {outputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void playChannelTest('left')}
              disabled={playingChannel !== null}
              className="gap-2"
            >
              <Speaker className="h-4 w-4" />
              Left channel
            </Button>
            <Button
              variant="outline"
              onClick={() => void playChannelTest('right')}
              disabled={playingChannel !== null}
              className="gap-2"
            >
              <Speaker className="h-4 w-4" />
              Right channel
            </Button>
            <Button
              onClick={() => void playChannelTest('both')}
              disabled={playingChannel !== null}
              className="gap-2"
            >
              <Speaker className="h-4 w-4" />
              Both channels
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            {playingChannel
              ? `Playing test tone (${playingChannel === 'left' ? 'left channel' : playingChannel === 'right' ? 'right channel' : 'both channels'})…`
              : 'You should hear a brief tone coming from the corresponding side.'}
          </p>
          {speakerError && (
            <p className="text-sm text-red-400">
              {'Could not play the sound: '}
              {speakerError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
