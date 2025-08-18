# Week 4
----
*[Repo](https://github.com/DakPro/low_power_speech_recognition) for the project code.
Many of the used services use huggingface client, so setting up huggingface access token is recommended.*

----

### Setting up access token
----
1. Login in [huggingface](https://huggingface.co)
2. Goto [Settings](https://huggingface.co/settings/profile)
3. Goto Access tokens
4. Create a new token (read-only recommended)


### Using access token
----
1. <code>brew install huggingface-cli</code>
2. <code> hf auth login </code>
3. Input the access token

When making requests to huggingface client, programs will automatically use the token.



## Planned structure of the repo
----
* Outer file <code> transcription_from_mic.py</code>: given a model name runs
a runtime transcription demo.
* Outer file <code> transcription_from_file.py</code>: given a model name and file
transcribes the file.
    * The irreplaceable part of model pipeline (usually copied from the model source)
* Separate directory for each model, includes
    * Some stuff used before (like reports, scripts)?
    * Interface to use the model, both for demo (with printing captions) and production
* Directory for testing - for interaction with datasets
