from griptape.rules import Rule
from griptape.structures import Workflow
from griptape.tasks import PromptTask,ToolkitTask,TextSummaryTask
from griptape.tools import WebScraper, TaskMemoryClient,WebSearch, FileManager
from griptape.drivers import OpenAiChatPromptDriver,DuckDuckGoWebSearchDriver, OpenAiAudioTranscriptionDriver
from griptape.utils import StructureVisualizer
from griptape.engines import AudioTranscriptionEngine
from griptape.tools.audio_transcription_client.tool import AudioTranscriptionClient
from griptape.drivers import audio_transcription
from griptape.structures import  Agent
import webbrowser
import logging
import os
import io
import numpy as np
import sounddevice as sd
from scipy.io import wavfile
import time


directory = "C:/Users/evkou/Desktop/DiscordBots/Files/soundrecordings/sound/"

def check_for_file(filename, directory):
    full_path = os.path.join(directory, filename)
    print(f"Checking for file '{full_path}'")
    while True:
        if os.path.exists(full_path):
            print(f"File '{full_path}' found!")
            return True
        else:
            print("File not found")
            return False
        


def record_audio(duration, sample_rate=44100, channels=1):
    print(f"Recording for {duration} seconds...")
    recording = sd.rec(int(duration * sample_rate),
                       samplerate=sample_rate,
                       channels=channels,
                       dtype='float32')
    sd.wait()
    print("Recording finished")
    return recording

def save_audio(filename, audio_data, sample_rate):
    wavfile.write(filename, sample_rate, (audio_data * 32767).astype(np.int16))
    print(f"Audio saved as {filename}")

def callAgent(f_name):
    folder_dir="C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/whisper_inputs"
    driver = OpenAiAudioTranscriptionDriver(
      model="whisper-1"
      )
    tool = AudioTranscriptionClient(
        off_prompt=False,
        engine=AudioTranscriptionEngine(
            audio_transcription_driver=driver,
        ),
    )
    Agent(
      tools=[FileManager(off_prompt=True),
        tool
      ],
    ).run(f"Transcribe the following audio file: {directory}{f_name}'. Separate all individual voices and assign them a new speaker number each time a different person speaks. Save the file under the filename: {f_name[:-3]}.txt on the 'C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/whisper_inputs' directory"
          )
    # Agent(OpenAiChatPromptDriver(
    #     model="gpt-4o-mini",
    #     temperature=0.2
    # ),
    # rules=[Rule(
    #     value="Be descriptive but not too much. Write the result as a prompt, without using periods, only commas, in a new file: {f_name[:-3]}_Context.txt"
    # )],
    #   tools=[
    #       FileManager(off_prompt=False)
    #   ],
    # ).run(f"Read file:{f_name} and generate a prompt based on the contents and describe the space where this takes place"
    #       )
    

def main():
    # ___________________________________________________________________________ S P E C I F Y THE DURATION________________________________________
    duration = 8
    print(f"the recording duration in seconds: {duration}")
    sample_rate = 44100  # CD quality
    channels =2 # Mono

    audio_data = record_audio(duration, sample_rate, channels)
    
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    f_name =f"recording_{timestamp}.wav"
    save_audio(filename=directory + f_name, audio_data=audio_data, sample_rate=sample_rate)

    

    file_found =check_for_file(filename=f_name,directory=directory)


    if file_found:
      callAgent(f_name=f_name)
    else:
        print("File not passed to Whisper")

if __name__ == "__main__":
    main()

