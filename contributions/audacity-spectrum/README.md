# Audacity Plot Spectrum reference

Can Audacity 4.2’s restored Plot Spectrum reproduce the same peaks and levels as Audacity 3? The analyzer is in development and the Audacity team has requested feedback on preserving its readings. [Audacity issue #12241](https://github.com/audacity/audacity/issues/12241), [design discussion](https://forum.audacityteam.org/t/help-us-bring-back-plot-spectrum-in-audacity-4-2/154996).

## Generate the audio

Run from the repository root with Python 3.9 or later.

```sh
python3 contributions/audacity-spectrum/spectrum_fixture.py generate two-tones.wav
```

The generator writes 65,536 mono samples at 48,000 Hz as signed 16-bit PCM. At a 4,096-sample FFT size, the bin spacing is 11.71875 Hz. The fixture contains two bin-centered tones with headroom for their sum.

| Bin | Frequency | Peak amplitude before quantization |
| --- | --- | --- |
| 40 | 468.75 Hz | 0.5 |
| 80 | 937.5 Hz | 0.125 |

The first tone should read about 12.04 dB above the second, from `20 × log10(0.5 / 0.125)`. This ratio is independent of the display’s absolute normalization.

## Record and compare app results

1. In Audacity 3, open `two-tones.wav` in a fresh project, confirm the track is mono at 48,000 Hz and select the entire track.
2. Open **Analyze → Plot Spectrum**. Set **Algorithm** to **Spectrum**, **Size** to **4096** and **Function** to the Hann window. Export the numeric spectrum to `audacity3-spectrum.txt`.
3. Repeat with the candidate Audacity 4.2 build when available. Save that export as `audacity4-spectrum.txt` and record both app versions, the operating system and the chosen settings. [Plot Spectrum manual](https://manual.audacityteam.org/man/plot_spectrum.html).

```sh
python3 contributions/audacity-spectrum/spectrum_fixture.py check audacity3-spectrum.txt
python3 contributions/audacity-spectrum/spectrum_fixture.py check audacity3-spectrum.txt audacity4-spectrum.txt
```

The checker expects the Audacity 3 English text export format with tab-separated `Frequency (Hz)` and `Level (dB)` columns. If a candidate build uses a different format, normalize the columns and preserve all bins and numeric precision. [Audacity 3 export implementation](https://github.com/audacity/audacity/blob/Audacity-3.7.9/src/FreqWindow.cpp#L938-L977).

A passing export has both tones among its two strongest local peaks within one FFT bin of the expected frequencies and a level gap within 1 dB of 12.04 dB. A passing comparison also matches the corresponding measured peaks across versions within one bin and 1 dB. The check covers this fixture and leaves other windows, sample rates, and multitrack selection behavior open.

## Verification so far

An independent discrete Fourier transform of the generated PCM using a Hann window measured peaks at 468.75 Hz (−6.020860 dB) and 937.5 Hz (−18.061986 dB), a 12.041126 dB gap. The checker accepted that reference and rejected deliberate errors in peak placement, gain and frequency grid. Audacity 3 and 4.2 app exports are still needed for the version comparison.
