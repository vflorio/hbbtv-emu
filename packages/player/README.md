# @hbb-emu/player

Type-safe video player state management system for HbbTV emulation, built with discriminated unions and fp-ts architectural patterns.

## Features

- **Hierarchical State Management**: Organized namespaces for Control, Source (MP4/HLS/DASH), and Error states
- **Type-Safe Transitions**: Compile-time guarantees for valid state transitions using fp-ts TaskEither/Either
- **Pattern Matching**: Exhaustive state handling with ts-pattern
- **Format-Specific States**: Dedicated state classes for MP4, HLS, and DASH streaming
- **Error Modeling**: Explicit distinction between recoverable and fatal errors
- **Immutable State**: All state objects are readonly and immutable

## Installation

This package is part of the hbbtv-emu monorepo:

```bash
pnpm install
```

## Core Concepts

### State Hierarchy

```
PlayerState
├── Control (Idle, Loading, Playing, Paused, Buffering, Seeking, Ended)
├── Source
│   ├── MP4 (Ready, ProgressiveLoading, DecodeError)
│   ├── HLS (ManifestLoading, ManifestParsed, VariantSelected, SegmentLoading, AdaptiveSwitching)
│   └── DASH (MPDLoading, MPDParsed, RepresentationSelected, SegmentDownloading, QualitySwitching)
└── Error (NetworkError, NotSupportedError, DRMError, AbortError)
```

### Tagged States

Every state has:
- `_tag`: Unique identifier (e.g., `'Control/Playing'`, `'Source/HLS/VariantSelected'`)
- `_tagGroup`: Category identifier (`'Playable'`, `'RecoverableError'`, `'FatalError'`)
- `isError`: Boolean flag for error states

## Usage Examples

### Basic Playback

```typescript
import { PlayerState, Transitions, Matchers, pipe, TE, E } from '@hbb-emu/player';

// Load and play an MP4 file
async function playMP4(url: string) {
  const result = await pipe(
    Transitions.loadSource({ url, sourceType: 'mp4' }),
    TE.chain((loading) => Transitions.completeLoading(loading, 'mp4')),
    TE.map((ready) => {
      console.log(Matchers.getStateDescription(ready));
      return ready;
    })
  )();

  if (E.isLeft(result)) {
    console.error('Load failed:', result.left);
    return;
  }

  // Transition to playing
  const pausedState = new PlayerState.Control.Paused(0, 120, []);
  const playResult = Transitions.play(pausedState);
  
  if (E.isRight(playResult)) {
    console.log('Now playing!');
  }
}
```

### HLS Adaptive Streaming

```typescript
import { PlayerState, Transitions, Matchers, pipe, TE, E } from '@hbb-emu/player';

async function streamHLS(manifestUrl: string) {
  // Load manifest
  const result = await pipe(
    Transitions.loadSource({ url: manifestUrl, sourceType: 'hls' }),
    TE.chain((loading) => Transitions.completeLoading(loading, 'hls')),
    TE.chain((state) => {
      if (state._tag === 'Source/HLS/ManifestLoading') {
        return Transitions.parseHLSManifest(state);
      }
      return TE.left(new Error('Invalid state'));
    })
  )();

  if (E.isRight(result)) {
    const parsed = result.right;
    console.log(`Found ${parsed.variants.length} quality variants`);
    
    // Select best variant
    const bestVariant = parsed.variants[0];
    const selectResult = Transitions.selectHLSVariant(parsed, {
      variant: bestVariant,
      reason: 'bandwidth',
    });
    
    if (E.isRight(selectResult)) {
      const quality = Matchers.getQualityInfo(selectResult.right);
      console.log(`Selected: ${quality?.resolution.width}x${quality?.resolution.height}`);
    }
  }
}
```

### Pattern Matching

```typescript
import { Matchers } from '@hbb-emu/player';

function handleStateChange(state: PlayerState.Any) {
  // Get description
  console.log(Matchers.getStateDescription(state));
  
  // Use pattern matching
  const action = Matchers.matchPlayerState(state)
    .with({ _tag: 'Control/Playing' }, (s) => ({
      type: 'show-pause-button',
      time: s.currentTime,
    }))
    .with({ _tag: 'Control/Paused' }, () => ({
      type: 'show-play-button',
    }))
    .with({ isError: true }, (s) => ({
      type: 'show-error',
      message: s.error.message,
    }))
    .with({ _tagGroup: 'Playable' }, () => ({
      type: 'enable-controls',
    }))
    .otherwise(() => ({
      type: 'show-loading',
    }));
    
  return action;
}
```

### State Machine

```typescript
import { PlayerStateMachine } from '@hbb-emu/player';

const player = new PlayerStateMachine();

// Load source
await player.loadSource('https://example.com/video.mp4', 'mp4');

// Control playback
player.play();
await player.seek(30);
player.pause();

// Check state
const currentState = player.getState();
console.log(Matchers.getStateDescription(currentState));
```

### Error Handling

```typescript
import { Transitions, Matchers, E } from '@hbb-emu/player';

async function loadWithRetry(url: string, maxRetries = 3) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    const result = await Transitions.loadSource({ url, sourceType: 'hls' })();
    
    if (E.isRight(result)) {
      return result.right;
    }
    
    const error = result.left;
    
    // Check if recoverable
    if (Matchers.isRecoverable(error)) {
      const retryResult = Transitions.retry(error, maxRetries);
      
      if (E.isRight(retryResult)) {
        retryCount++;
        console.log(`Retrying (${retryCount}/${maxRetries})...`);
        continue;
      }
    }
    
    // Fatal error or max retries exceeded
    console.error('Load failed:', Matchers.getStateDescription(error));
    break;
  }
  
  return null;
}
```

## API Reference

### State Classes

#### Control States
- `PlayerState.Control.Idle`: Initial state
- `PlayerState.Control.Loading`: Loading media source
- `PlayerState.Control.Playing`: Active playback
- `PlayerState.Control.Paused`: Playback paused
- `PlayerState.Control.Buffering`: Buffering content
- `PlayerState.Control.Seeking`: Seeking to new position
- `PlayerState.Control.Ended`: Playback completed

#### Source States (MP4)
- `PlayerState.Source.MP4.Ready`: MP4 ready to play
- `PlayerState.Source.MP4.ProgressiveLoading`: Progressive download
- `PlayerState.Source.MP4.DecodeError`: Decoding failed

#### Source States (HLS)
- `PlayerState.Source.HLS.ManifestLoading`: Loading manifest
- `PlayerState.Source.HLS.ManifestParsed`: Manifest parsed
- `PlayerState.Source.HLS.VariantSelected`: Quality variant selected
- `PlayerState.Source.HLS.SegmentLoading`: Loading segment
- `PlayerState.Source.HLS.AdaptiveSwitching`: Switching quality

#### Source States (DASH)
- `PlayerState.Source.DASH.MPDLoading`: Loading MPD
- `PlayerState.Source.DASH.MPDParsed`: MPD parsed
- `PlayerState.Source.DASH.RepresentationSelected`: Quality selected
- `PlayerState.Source.DASH.SegmentDownloading`: Downloading segment
- `PlayerState.Source.DASH.QualitySwitching`: Switching quality

#### Error States
- `PlayerState.Error.NetworkError`: Network failure (recoverable)
- `PlayerState.Error.NotSupportedError`: Format not supported (fatal)
- `PlayerState.Error.DRMError`: DRM failure (fatal)
- `PlayerState.Error.AbortError`: Operation aborted (recoverable)

### Transition Functions

All transitions return either `E.Either` (sync) or `TE.TaskEither` (async).

- `Transitions.loadSource(params)`: Load media source
- `Transitions.play(state)`: Start playback
- `Transitions.pause(state)`: Pause playback
- `Transitions.seek(params)`: Seek to position
- `Transitions.startBuffering(state)`: Begin buffering
- `Transitions.parseHLSManifest(state)`: Parse HLS manifest
- `Transitions.selectHLSVariant(state, params)`: Select HLS quality
- `Transitions.parseDASHMPD(state)`: Parse DASH MPD
- `Transitions.selectDASHRepresentation(state, params)`: Select DASH quality
- `Transitions.retry(state, maxRetries)`: Retry failed operation
- `Transitions.reset(state)`: Reset to idle

### Matchers & Helpers

#### Type Guards
- `Matchers.isPlayable(state)`: Check if state is playable
- `Matchers.isError(state)`: Check if state is an error
- `Matchers.isRecoverable(state)`: Check if error is recoverable
- `Matchers.isFatal(state)`: Check if error is fatal
- `Matchers.isHLSState(state)`: Check if HLS-specific
- `Matchers.isDASHState(state)`: Check if DASH-specific

#### Utilities
- `Matchers.getStateDescription(state)`: Human-readable description
- `Matchers.getCurrentTime(state)`: Get current playback time
- `Matchers.getDuration(state)`: Get media duration
- `Matchers.getQualityInfo(state)`: Get quality information
- `Matchers.canSeek(state)`: Check if seeking is allowed
- `Matchers.canControl(state)`: Check if controls are enabled
- `Matchers.isPlaying(state)`: Check if actively playing
- `Matchers.isLoading(state)`: Check if loading content

## Architecture

### Namespace Pattern

States are organized in hierarchical namespaces:

```typescript
export namespace PlayerState {
  export namespace Control { /* ... */ }
  export namespace Source {
    export namespace MP4 { /* ... */ }
    export namespace HLS { /* ... */ }
    export namespace DASH { /* ... */ }
  }
  export namespace Error { /* ... */ }
  
  export type Any = Control.Any | Source.Any | Error.Any;
}
```

### Base Classes

Three abstract base classes provide common behavior:

- `PlayableState`: Valid operational states
- `RecoverableError`: Errors that can be retried
- `FatalError`: Errors requiring user intervention

### Union Types

Compositional type unions at each level:

```typescript
export type Any = /* all states */;
export type Playable = Extract<Any, { _tagGroup: 'Playable' }>;
export type Errors = Extract<Any, { isError: true }>;
```

## Testing

Run the example suite:

```bash
pnpm --filter @hbb-emu/player run build
node packages/player/dist/examples.js
```

## License

Part of the hbbtv-emu project.
