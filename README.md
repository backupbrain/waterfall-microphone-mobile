# Waterfall

A live waterfall spectrogram of the sound around you, built with Expo for iOS, Android, and the web.

The app listens to the microphone, runs a 4096-point FFT over the stream, and paints each spectrum as a new row at the top of a GPU-rendered waterfall that falls down the screen. Left to right is pitch, from 0 Hz up to the microphone's Nyquist frequency (half the sample rate, typically 24 kHz). Brightness is loudness, auto-ranged so quiet rooms still glow.

## Run it

```bash
pnpm install
```

```bash
npx expo start
```

Press `w` for the web build, `i` for the iOS Simulator, or `a` for an Android emulator. Expo Go works on both platforms because every native module used here (`expo-audio`, `expo-gl`, `expo-blur`, `react-native-svg`) ships inside Expo Go. For a development build instead, run `npx expo run:ios` or `npx expo run:android`.

Microphone capture in the browser requires HTTPS or `localhost`.

Simulator notes: the iOS 17.x Simulator runtime on Apple Silicon crashes inside Apple's OpenGL ES shader compiler (`cvmsServerElementBuild`) for any GL app, including this one; use an iOS 18 or iOS 26 simulator, or a real device. The Simulator forwards the Mac's default input device, so the waterfall only shows sound if the Simulator app has microphone access in macOS System Settings.

## Controls

- Tap the waterfall to freeze it; tap again to resume.
- Drag across the waterfall to read the frequency under your finger (hover with a mouse on the web).
- The bottom bar pauses, cycles the colour palette, switches between linear and logarithmic pitch axes, and opens the info panel.
- On the web, Space pauses, `P` changes palette, `L` toggles the scale, and `I` opens the info panel.

## How it is built

- `src/audio/` captures PCM audio. On iOS and Android it uses `expo-audio`'s `useAudioStream`; on the web it uses the Web Audio API with an `AudioWorklet` (falling back to `ScriptProcessorNode`). Both feed the same `SpectrumEngine`, which windows the samples, runs the FFT, converts to decibels, and quantises rows into a bounded queue.
- `src/waterfall/` renders with `expo-gl`. Each row is a single-row `texSubImage2D` into a ring-buffer texture; a fragment shader maps screen rows back to texture rows and colours them through a 1-D palette lookup, so no pixels are ever copied on the CPU. The same WebGL code runs on all three platforms.
- `src/components/` is the UI, built from [HeroUI Native](https://heroui.com/docs/native) components (`Button`, `Card`, `Chip`, `Dialog`, `Surface`, `Tabs`, `Typography`) styled with Tailwind via Uniwind. The theme tokens live in `src/global.css`.

## Scripts

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm build:web
```

## License

MIT. See [LICENSE](LICENSE).
