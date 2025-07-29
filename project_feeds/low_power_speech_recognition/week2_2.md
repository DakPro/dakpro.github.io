## Week 2 part 2

After evaluation of previous models' performances, we decided to try to fit Voxtral - another transformer model.

The mini version of the model is 3b parameters, weights 8 gb, which took quite a long time to download even for Mac. As kyutai with 1b parameters was way too slow on rPi, I decided that there's no point in trying to run Voxtral on rPi.

At this point it became obvious that most models are made for powerful devices with GPU. Thus, a decision was made to rather look for a model definitely smaller than 1b params rather than trying out every model we pass by.

Of course the exact speed of the model depends on the pipeline itself but the constant
factor caused by this cannot outweight the fact that kuytai took about 10s to transcribe 1s
of audio on 4/4 threads.

### Hugging face

Hugging face is an open-source platform for AI models. Similar to github, not only it provides most (if not all) models with their "model cards", but also has leaderboards for the models. This is what I'll be working with next.

<a href="https://huggingface.co/spaces/hf-audio/open_asr_leaderboard">Here</a> one can find
the leaderboard of the speech-recognition models. We are interested in two criteria: WER (word error rate) and RTFx (time of the audio being transcribed/transcription time).

The tiny.en model without quantization has RTFx of 348, base.en has 320.

Interesting models:

nvidia/parakeet-tdt_ctc-110m - 7.49 /
5345.14

nvidia/parakeet-tdt-0.6b-v2  - 6.05
3386.02

nvidia/canary-180m-flash     - 7.12 / 2053.15

UsefulSensors/moonshine-tiny - 9.99 / 565.97

nvidia/parakeet-rnnt-0.6b    - 7.5  / 2815.72      (no punctuation/capitalization)

nvidia/parakeet-ctc-0.6b     - 7.69 / 4281.53       (no punctuation/capitalization)
