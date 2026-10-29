import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CameraRegular,
  MicRegular,
  Speaker2Regular,
  SpeakerBoxRegular,
  VideoOffRegular,
  VideoRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card, Section, SettingsCard } from '@/components/ui/Card'
import { InfoBar, ProgressBar } from '@/components/ui/feedback'
import { Select } from '@/components/ui/inputs'
import { cn } from '@/lib/utils'

const SINGLE_CHANNEL_DURATION_MS = 1200
const BOTH_CHANNELS_SEGMENT_MS = 1e3
const MIC_LEVEL_UPDATE_MS = 66

const CHANNEL_LABELS = { left: 'left channel', right: 'right channel', both: 'left, then right' }

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
    <Page
      title="Audio & camera"
      description="Live camera preview, microphone input level and a test tone per speaker channel."
      actions={
        isActive ? (
          <Button icon={VideoOffRegular} onClick={stopAll}>
            Stop camera & mic
          </Button>
        ) : (
          <Button
            variant="accent"
            icon={VideoRegular}
            onClick={() => void startTest()}
            disabled={status === 'requesting'}
          >
            {status === 'requesting' ? 'Requesting access…' : 'Start camera & mic'}
          </Button>
        )
      }
    >
      {status === 'error' && (
        <InfoBar
          severity="error"
          title="Couldn't access the camera or microphone."
          className="mb-4"
        >
          {errorMessage}. Check Settings → Privacy & security → Camera / Microphone.
        </InfoBar>
      )}
      <Section title="Camera and microphone">
        <Card className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-overlay bg-black">
            <video
              ref={videoRef}
              autoPlay={true}
              muted={true}
              playsInline={true}
              aria-label="Camera preview"
              className={cn('h-full w-full -scale-x-100 object-cover', !isActive && 'hidden')}
            />
            {!isActive && (
              <div className="flex flex-col items-center gap-2 text-white/70">
                <CameraRegular aria-hidden className="size-8" />
                <span>Camera is off</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-5">
            {videoDevices.length > 1 && (
              <Select
                id="camera-device"
                label="Camera"
                value={selectedVideoDeviceId}
                onChange={(value) => void switchCamera(value)}
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MicRegular aria-hidden className="size-4" />
                <span>Input level</span>
                {isActive && (
                  <span className="ml-auto text-caption text-text-secondary">{levelPercent}%</span>
                )}
              </div>
              <ProgressBar
                label="Microphone level"
                value={isActive ? levelPercent : 0}
                tone={levelPercent < 60 ? 'accent' : levelPercent < 85 ? 'caution' : 'critical'}
                className="h-1"
              />
              <p className="text-caption text-text-secondary">
                {isActive
                  ? 'Speak or make a sound near the microphone: the bar should move.'
                  : 'Start the camera and microphone to see the input level.'}
              </p>
            </div>
            <p className="mt-auto text-caption text-text-tertiary">
              The microphone isn&apos;t played back through the speakers (only its level is
              measured), so there&apos;s no feedback or echo.
            </p>
          </div>
        </Card>
      </Section>

      <Section title="Speakers">
        {outputDevices.length > 0 && (
          <SettingsCard icon={SpeakerBoxRegular} title="Output device">
            <Select
              id="output-device"
              value={selectedOutputId}
              onChange={setSelectedOutputId}
              className="w-64 max-w-full"
            >
              <option value="default">System default</option>
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </Select>
          </SettingsCard>
        )}
        <SettingsCard
          icon={Speaker2Regular}
          title="Channel test"
          description={
            playingChannel
              ? `Playing a tone on the ${CHANNEL_LABELS[playingChannel]}…`
              : 'Plays a short tone; it should come only from the matching side.'
          }
        >
          <Button onClick={() => void playChannelTest('left')} disabled={playingChannel !== null}>
            Left
          </Button>
          <Button onClick={() => void playChannelTest('right')} disabled={playingChannel !== null}>
            Right
          </Button>
          <Button
            variant="accent"
            onClick={() => void playChannelTest('both')}
            disabled={playingChannel !== null}
          >
            Both
          </Button>
        </SettingsCard>
        {speakerError && (
          <InfoBar
            severity="error"
            title="Couldn't play the sound."
            onDismiss={() => setSpeakerError(null)}
          >
            {speakerError}
          </InfoBar>
        )}
      </Section>
    </Page>
  )
}
