# Week 2 part 1

From last week, problem of memory shortage exists: track of memory usage shows that the process tries to use more and more memory, resulting in a crash and thus the process being killed by the OS.

Solution 1:
Using microSD partially as RAM:
<pre><code>
# Enabling usage of 8GB for swapping
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Making it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

...

# Disabling swapping
sudo swapoff /swapfile

# Permanent disabling
sudo rm /swapfile
... (remove line from fstab)
sudo reboot
</code></pre>

This showed that the model needs only 1.6GB more memory. As microSD memory is too slow, the model running took enormous time to complete and thus was terminated.

One could 1) use ssd instead - too costly and crosses idea of small-power; 2) use rPi with bigger RAM (currenty 4 gb).

## Returning back to whisper.cpp

### Evaluation of the three models
----

Decided to do evaluation of speed of transcription using different models.

Here is time and memory usage for transcribing an 11s JFK speech using 4/4 threads and standart OS:
<table>
    <tr>
        <th>Model</th>
        <th>Time</th>
        <th>Memory</th>
    </tr>
    <tr>
        <td>tiny</td>
        <td>8.3 s</td>
        <td>77 MB</td>
    </tr>
    <tr>
        <td>tiny.en</td>
        <td>8.5 s</td>
        <td>77 MB</td>
    </tr>
    <tr>
        <td>base</td>
        <td>18 s</td>
        <td>147 MB</td>
    </tr>
    <tr>
        <td>base.en</td>
        <td>21 s</td>
        <td>256MB</td>
    </tr>
    <tr>
        <td>small</td>
        <td>64 s</td>
        <td>487 MB</td>
    </tr>
    <tr>
        <td>small.en</td>
        <td>65 s</td>
        <td>487 MB</td>
    </tr>
</table>

The performance test was performed once and only on one recording.

Optimization of loading time and other inter-sample could be considered for real-time transcription.

<i>Same evaluation on rPi 5 (possibly with 8gb RAM) could be reasonable due to CPU difference, but despite being 2x times faster, it requires fan/active cooling.</i>

After iterational refinement, the following script is used as <code>~/eval.sh</code> for evaluation:

<pre><code>
#!/bin/bash

models=()
while [ $# -gt 0 ]; do
  models+=( "$1" )
  shift
done

echo "models: ${models[@]}"
touch report.log
echo "Report on model evaluation. The duration of sample recording is 11s (JFK speech)" > report.log
cd whisper.cpp
echo -n "Building whisper-cli... "
cmake -B build > /dev/null
cmake --build build -j --config Release > /dev/null
echo "whisper-cli build"
base_models=("tiny" "tiny.en" "base" "base.en" "small" "small.en" "medium" "medium.en")
echo "-----------------------------"
echo "-----------------------------" >> ../report.log

is_base_model(){
 	for bm in "${base_models[@]}"; do
    if [[ "$1" =~ ^"${bm}"$ ]]; then
   	echo "$1 IS base model"
   	return 0
    fi
  done
	echo "$1 is not a base model"
	return 1
}


for model in "${models[@]}"; do
	echo "Model $model" >> ../report.log
	if is_base_model $model; then
		echo "Starting model $model evaluation"
		if [ ! -f models/$model.bin ]; then
			echo -n "Model not found... Downloading $model... "
      			sh ./models/download-ggml-model.sh $model > /dev/null
			mv models/ggml-$model.bin models/$model.bin
      			echo "Downloaded"
		fi
		path="models/$model.bin"
	else
		echo -n "Looking for quantized model $model... "
		if [ ! -f quantized_models/$model.bin ]; then
			echo "Quantized model not found. Skipping..."
			continue
		fi
		path="quantized_models/$model.bin"
		echo "Quantized model found"
	fi
	echo -n "Runtime: " >> ../report.log
	echo -n "Running $model... "
	./build/bin/whisper-cli -m $path -f samples/jfk.wav > tmp.out 2>&1

  # for debugging
  # cat tmp.out

  grep -i -E "total memory|total time" tmp.out >> ../report.log
  echo "run"
  echo "----------------------------------" >> ../report.log
  echo "----------------------------------"
done
</code></pre>

### Quantization of whisper
----
Unlike kyutai, whisper supports built-in quantization.

Notes on choosing quantizations:

Qx_y - x bits per weight, y - legacy flag, deprecated in favour of Qx_K

Qx_K - K-quants, better than standard, have mixed bit-widths

TQx - ternary quantization (ters instead of bits), extreme compression and quality drops too much

IQx_s - importance-aware quantization, much better quality for the same bit rates. s - size (S/M/L)

Based on this, will try with IQ4_M first.

After iterational refinement, this script was used as <code>~/qt.sh</code> for quantization:

<pre><code>

#!/bin/bash

echo "args: $@"

cd whisper.cpp
if [ $# -eq 0 ]; then
	echo "Error: quantization method is not provided."
	echo "Usage: $0 <quantization method 1> ... [-r <model: default:base>] "
	exit 1
fi
qms=()
model="base"
while [ $# -gt 0 ]; do
	echo "curr arg: $1"
	if [[ "$1" == "-m" ]]; then
		echo "equals to -m"
		shift
		model="$1"
		break
	fi
	qms+=("$1")
	shift
done
echo "qms: ${sqm[@]}"

if [ ! -d "quantized_models" ]; then
	mkdir quantized_models
fi
for qm in "${qms[@]}"; do
	./build/bin/quantize models/$model.bin quantized_models/$model-$qm.bin $qm
done

</code></pre>

-------

After spending some time figuring why the model doesn't want to be quantized to IQ4_M, it turns out that models possible for quantization are listed in lines 50-80 of file common-ggml.cpp.

After small experimenting with <code>base</code> model:

q5_0 - improvement from 18.1 to 14.3 (encoding time: 14.5 to 11.4 )

q2_k - model starts outputing "you you you" -> not enough quality

q5_k - improvement from 18.1 to 13.2 (encoding time: 14.7 to 10.6)

Further evaluations:

### Model Evaluation on 11s sample
----
<caption> Model Evaluation Report (11s JFK Speech Sample)</caption>
<table>
    <thead>
      <tr>
        <th>Model</th>
        <th>Runtime (s)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="2" style="background-color: #e0e0e0; font-weight: bold;">Small Models</td>
      </tr>
      <tr>
        <td>small-q2_k</td>
        <td>38.4</td>
      </tr>
      <tr>
        <td>small-q3_k</td>
        <td>46.2</td>
      </tr>
      <tr>
        <td>small-q4_0</td>
        <td>39.8</td>
      </tr>
      <tr>
        <td>small-q4_1</td>
        <td>39.1</td>
      </tr>
      <tr>
        <td>small-q4_k</td>
        <td>37.3</td>
      </tr>
      <tr>
        <td>small-q5_0</td>
        <td>47</td>
      </tr>
      <tr>
        <td>small-q5_1</td>
        <td>49.7</td>
      </tr>
      <tr>
        <td>small-q5_k</td>
        <td>44.7</td>
      </tr>
      <tr>
        <td>small-q6_k</td>
        <td>46.6</td>
      </tr>
      <tr>
        <td>small-q8_0</td>
        <td>40.5</td>
      </tr>
      <tr>
        <td>small</td>
        <td>76.3</td>
      </tr>
      <tr>
        <td colspan="2" style="background-color: #e0e0e0; font-weight: bold;">Base Models</td>
      </tr>
      <tr>
        <td>base-q2_k</td>
        <td>75.9</td>
      </tr>
      <tr>
        <td>base-q3_k</td>
        <td>13.7</td>
      </tr>
      <tr>
        <td>base-q4_0</td>
        <td>12.6</td>
      </tr>
      <tr>
        <td>base-q4_1</td>
        <td>12.3</td>
      </tr>
      <tr>
        <td>base-q4_k</td>
        <td>11.9</td>
      </tr>
      <tr>
        <td>base-q5_0</td>
        <td>14.4</td>
      </tr>
      <tr>
        <td>base-q5_1</td>
        <td>14.4</td>
      </tr>
      <tr>
        <td>base-q5_k</td>
        <td>13.3</td>
      </tr>
      <tr>
        <td>base-q6_k</td>
        <td>13.6</td>
      </tr>
      <tr>
        <td>base-q8_0</td>
        <td>12.8</td>
      </tr>
      <tr>
        <td>base</td>
        <td>18.2</td>
      </tr>
    </tbody>
  </table>

Issue: q2_k should be smaller and faster, while it's not. Small-q2_k doesn't get stuck and actually produces the correct transcription, so performance decrease is somewhere else.

Turns out q2_k/q3_k are optimized for AVX2/AVX512 (Single Instruction, Multiple Data commands extensions) in x86 architecture. For rPi running on ARM CPU, those are absent and quantization overhead becomes cosmic, thus slowing down in performance. Model getting stuck on "you you you" is likely result of poor resulting precision of the model.

In theory, base-q4_k run on a headless setup should be sufficient at least for with additional bit of time for transcription (for instance, additional 5-10 mins after an hour-long meeting). But if we want to achieve real-time
transcription, one should seek for alternatives.
