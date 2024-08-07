import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Regions from 'wavesurfer.js/dist/plugins/regions.esm.js';
import '../wavesurfer-styles.css';

const AudioEditor = () => {
  const waveformRef = useRef(null);
  const waveSurferInstance = useRef(null);
  const [waveHeight, setWaveHeight] = useState(150);
  const [waveWidth, setWaveWidth] = useState(441);
  const [loadingError, setLoadingError] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [regionsPlugin, setRegionsPlugin] = useState(null); // Track Regions Plugin instance
  const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)()); // Define audioContext
  useEffect(() => {
    let isMounted = true;
  
    if (waveformRef.current) {
      if (waveSurferInstance.current) {
        waveSurferInstance.current.destroy();
      }
  
      const regions = Regions.create();
      setRegionsPlugin(regions);
  
      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4F4A85',
        height: waveHeight,
        barWidth: 2,
        width: waveWidth,
        cursorWidth: 0,
        plugins: [regions],
      });
  
      waveSurferInstance.current = ws;
  
      regions.enableDragSelection({
        color: 'rgba(255, 0, 0, 0.1)',
      });
  
      const loadAudio = async () => {
        setLoadingError(null);
        if (audioFile) {
          try {
            const objectUrl = URL.createObjectURL(audioFile);
            await ws.load(objectUrl);
          } catch (error) {
            if (isMounted) {
              setLoadingError('Error loading audio file: ' + error.message);
            }
          }
        } else {
          setLoadingError('Please upload an audio file to generate the waveform.');
        }
      };
  
      loadAudio();
  
      ws.on('ready', () => {
        console.log('WaveSurfer is ready and audio is loaded');
      });
  
      ws.on('region-created', (region) => {
        setSelectedRegion(region);
        console.log('Region created:', region);
      });
  
      ws.on('region-updated', (region) => {
        setSelectedRegion(region);
      });
  
      ws.on('region-click', (region) => {
        setSelectedRegion(region);
      });
  
      return () => {
        isMounted = false;
        if (ws) {
          ws.destroy();
        }
      };
    }
  }, [audioFile, waveHeight, waveWidth]);
  
  
  const trimAudio = async () => {
    const ws = waveSurferInstance.current;
    const regionsPluginInstance = regionsPlugin;
  
    if (!ws || !regionsPluginInstance) {
      console.error('WaveSurfer or Regions plugin instance is not available.');
      return;
    }
  
    const regionList = regionsPluginInstance.getRegions();
    if (!regionList.length) {
      console.error('No regions available for trimming.');
      return;
    }
  
    const region = regionList[0];
    const { start, end } = region;
  
    if (start === undefined || end === undefined) {
      console.error('Region start or end is undefined.');
      return;
    }
  
    const startFloat = parseFloat(start.toFixed(2));
    const endFloat = parseFloat(end.toFixed(2));
    const originalBuffer = ws.getDecodedData();
    console.log('fdf', ws.buffer);
  
    if (!originalBuffer) {
      console.error('Original buffer is not available.');
      return;
    }
  
    console.log('Original buffer:', originalBuffer);
  
    const sampleRate = originalBuffer.sampleRate;
    const duration = originalBuffer.duration;
    const numOfChannels = originalBuffer.numberOfChannels;
    
    // Calculate the start and end sample indices
    const startSample = Math.floor(startFloat * sampleRate);
    const endSample = Math.floor(endFloat * sampleRate);
  
    // Create new buffer excluding the trimmed segment
    const newBuffer = audioContext.current.createBuffer(numOfChannels, originalBuffer.length - (endSample - startSample), sampleRate);
  
    for (let i = 0; i < numOfChannels; i++) {
      const oldData = originalBuffer.getChannelData(i);
      const newData = newBuffer.getChannelData(i);
  
      // Copy data before the trimmed segment
      newData.set(oldData.subarray(0, startSample));
  
      // Copy data after the trimmed segment
      newData.set(oldData.subarray(endSample), startSample);
    }
  
    // Create a blob from the new buffer and reload it
    const blob = await bufferToBlob(newBuffer);
    ws.loadBlob(blob);
    console.log('Trimmed segment from', startFloat, 'to', endFloat);
  };
  
  // Utility function to convert AudioBuffer to Blob
// Utility function to convert AudioBuffer to Blob
const bufferToBlob = (audioBuffer) => {
  return new Promise((resolve, reject) => {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    
    let offset = 0; // Change from const to let
    let pos = 0;    // Change from const to let

    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < numOfChan; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample * 32767) | 0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true); // write 16-bit sample
        pos += 2;
      }
      offset++;
    }

    resolve(new Blob([buffer], { type: 'audio/wav' }));
  });
};


  
  
  
  

  const handleFileChange = (event) => {
    if (event.target.files.length > 0) {
      setAudioFile(event.target.files[0]);
    }
  };

  const handleDelete = () => {
    if (regionsPlugin && waveSurferInstance.current) {
      const { currentTime } = waveSurferInstance.current;
      const deletedRegions = regionsPlugin.getRegions();

      deletedRegions.forEach(region => {
        const { start, end } = region;
        if (currentTime >= start && currentTime <= end) {
          waveSurferInstance.current.seekTo(end);
          regionsPlugin.remove(region.id);
        }
      });
    } else {
      console.error('Regions plugin not initialized or WaveSurfer instance not available.');
    }
  };



  return (
    <div>
      <div>
        <label>
          Upload Audio:
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
          />
        </label>
      </div>
      <div>
        <label>
          Wave Height:
          <input
            type="range"
            min="50"
            max="300"
            value={waveHeight}
            onChange={(e) => setWaveHeight(Number(e.target.value))}
          />
        </label>
      </div>
      <div>
        <label>
          Wave Width:
          <input
            type="range"
            min="200"
            max="1000"
            value={waveWidth}
            onChange={(e) => setWaveWidth(Number(e.target.value))}
          />
        </label>
      </div>
      {loadingError && <p>Error: {loadingError}</p>}
      <button onClick={handleDelete}>Delete Selected Region</button>
      <button onClick={trimAudio}>Trim Selected Region</button>
      <div
        ref={waveformRef}
        id="waveform"
        style={{ width: `${waveWidth}px`, height: `${waveHeight}px`, backgroundColor: '#f0f0f0' }}
      ></div>
    </div>
  );
};

export default AudioEditor;
