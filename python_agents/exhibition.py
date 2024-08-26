from griptape.rules import Rule,Ruleset
from griptape.structures import Workflow
from griptape.tasks import PromptTask,ToolkitTask,TextSummaryTask
from griptape.tools import WebScraper, TaskMemoryClient,WebSearch, FileManager
from griptape.drivers import OpenAiChatPromptDriver,DuckDuckGoWebSearchDriver, OpenAiAudioTranscriptionDriver
from griptape.utils import StructureVisualizer
from griptape.engines import AudioTranscriptionEngine
from griptape.tools.audio_transcription_client.tool import AudioTranscriptionClient
from griptape.drivers import audio_transcription
from griptape.structures import  Agent
from urllib import request, parse
import json
import logging
import random
import os
import io
import numpy as np
import sounddevice as sd
from scipy.io import wavfile
import time
import asyncio
import sys
import shutil


##Drop a rerun for when a file is appearing_____________________________________________________________
class ImageWatcher:
    def __init__(self, image_folder):
        self.image_folder = image_folder
        self.initial_files = set(os.listdir(image_folder))

    async def wait_for_new_file(self, timeout=300):
        start_time = time.time()
        while time.time() - start_time < timeout:
            current_files = set(os.listdir(self.image_folder))
            new_files = current_files - self.initial_files
            new_png_files = [f for f in new_files if f.lower().endswith('.png')]
            
            if new_png_files:
                newest_file = max(new_png_files, key=lambda f: os.path.getctime(os.path.join(self.image_folder, f)))
                return os.path.join(self.image_folder, newest_file)
            
            await asyncio.sleep(1)  # Check every second
        
        return None  # Timeout occurred

directory = "C:/Users/evkou/Desktop/DiscordBots/Files/soundrecordings/sound/"
response_dir = "C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/whisper_inputs/"
promptDirectory = "C:/Users/evkou/Desktop/DiscordBots/Exhibition/promptsforComfy/"
comfydir = "C:/Users/evkou/Documents/Sci_Arc/Sci_Arc_Studio/ComfyUi/ComfyUI_windows_portable/ComfyUI/output"
destination_folder = "C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/comfyui_images"

async def queue_prompt(prompt):
        p = {"prompt": prompt}
        data = json.dumps(p).encode('utf-8')
        req =  request.Request("http://127.0.0.1:8188/prompt", data=data)
        request.urlopen(req)
    ##We have to find a way to pass the topic prompt to the json file of Comfy, Maybe Agent ?
    
async def pass_to_diffuser(topic: str):
    # output, error = await self.run_comfy_script("C:/Users/evkou/Documents/Sci_Arc/Sci_Arc_Studio/ComfyUi/ComfyUI_windows_portable/ComfyUI/ComfyUI-to-Python-Extension/Default.py")
    # if error:
    #     print(f"Error: {error}")
    # else:
    #     print(f"Image Passed to Comfy..... Waiting Respone......")

    with open("C:/Users/evkou/Desktop/DiscordBots/Exhibition/comfyJsonworkflows/Exh_Flux_Model.json","r") as f:
        prompt = json.load(f)
    #set the text prompt for our positive CLIPTextEncode
    #Its #6 for Flux, # ["42"]["inputs"]["STRING"] for IP_ADapter
    prompt["6"]["inputs"]["text"] = str(topic)

    # prompt["71"]["inputs"]["image"] = "C:/Users/evkou/Documents/Sci_Arc/Sci_Arc_Studio/ComfyUi/ComfyUI_windows_portable/ComfyUI/ComfyUI-to-Python-Extension/images/SDXL-UI-Example.PNG"

    #set the seed for our KSampler node
    prompt["45"]["inputs"]["noise_seed"] = int(random.uniform(0,2*64))


    await queue_prompt(prompt)

async def check_for_file(filename, directory):
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

async def callAgent(f_name):
    folder_dir="C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/whisper_inputs/"
    driver = OpenAiAudioTranscriptionDriver(
      model="whisper-1",
      )
    tool = AudioTranscriptionClient(
        off_prompt=False,
        engine=AudioTranscriptionEngine(
            audio_transcription_driver=driver,
        ),
    )
    Agent(
      tools=[FileManager(off_prompt=False),
        tool
      ],
    ).run(f"Transcribe the following audio file in en : {directory}{f_name} in english'. Separate all individual voices and assign them a new speaker number. Always no matter what, save the file under the filename: '{f_name[:-4]}.txt' on the 'C:/Users/evkou/Desktop/DiscordBots/Files/soundrecordings/transcriptions' and on the 'C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/whisper_inputs'"
          )

async def scriptAgent(input,f_name):
    Agent(
        OpenAiChatPromptDriver(
            model="gpt-4o-mini",
            temperature=0.9
        ),
        rules=[
        Rule("You are an architecture student in SciArc"),
        Rule(f"Your Task is to respond to this conversation {input} by defending your design skills,"),
        Rule("Never repeat anything previously said, Reply with a curt, mysterious, tone"),
        Rule(f"Save the output in the 'C:/Users/evkou/Downloads/AGENTSEE/AGENTSEE/whisper_inputs' directory with the filename: res_{f_name[:-3]} as a .txt file. ")
        ],
        tools=[ FileManager(off_prompt=False)],
    ).run(f"Contnue the conversation."
          )

async def comfyAgent(input,f_name):
    
    file_ruleset = Ruleset(
    name="file_saving",
    rules=[
        
    ],
    )
    
    prompt_ruleset = Ruleset(
    name="prompting",
    rules=[
    
    ],
    )

    Agent(OpenAiChatPromptDriver(
        model="gpt-4o-mini",
        temperature=0.7
    ),
    rules=[
        Rule("Formulate the input that you receive as a prompt for Stable Diffusion"),
        Rule("Only return the prompt, all sentences separated by commas, Never use periods or other symbols on your response."),
        Rule("The overall response should describe images, Architectural style, matching the style of a SciArc Exhibition for Technology in Architecture but in the context of what is said originally"),
        Rule("The style of the image should be Realistic, architectural with minimal concepts engraved to it, Be Creative!"),
        Rule(f"Save the output text in the {promptDirectory} directory with the filename: prompt_{f_name[:-3]} as a .txt file. ")   ],
      tools=[
          FileManager(off_prompt=False)
      ],
    ).run(f" You get the following topic : {input}")


async def main():
    # ___________________________________________________________________________ S P E C I F Y THE DURATION________________________________________
    #______________________________________________________________________________________________________________________________________________________DURATIOON FUCKER
    duration = 15 
    #______________________________________________________________________________________________________________________________________________________DURATIOON FUCKER
    print(f"the recording duration in seconds: {duration}")
    sample_rate = 44100  # CD quality
    channels =2 # Mono
    tr_dir = "C:/Users/evkou/Desktop/DiscordBots/Files/soundrecordings/transcriptions/"

    audio_data = record_audio(duration, sample_rate, channels)
    
    timestamp = time.strftime("%Y%m%d-%H%M")
    f_name =f"recording_{timestamp}.wav"
    save_audio(filename=directory + f_name, audio_data=audio_data, sample_rate=sample_rate)

    

    file_found = await check_for_file(filename=f_name,directory=directory)

    # transcript =check_for_file(filename = f'{f_name[:-4]}.txt',directory=tr_dir )

    if file_found:
        await callAgent(f_name=f_name)
        
        with open(f'{tr_dir}{f_name[:-3]}txt', 'r', encoding='utf-8', errors='replace') as file:
            content = file.read()
        
        asyncio.sleep(5)

        await scriptAgent(content,f_name=f_name)
        print("Called_ScriptAgent")

    else:
        print("File not passed to Whisper")
    
    #The agent needs to verify that he found the response to take as input for the prompt.
    response_found = await check_for_file(filename=f"res_{f_name[:-3]}txt",directory=response_dir)
    if response_found:
        with open(f'{response_dir}res_{f_name[:-3]}txt', 'r', encoding='utf-8', errors='replace') as file:
            content = file.read()
        await comfyAgent(content,f_name=f"res_{f_name[:-3]}txt")


    #This has to be the prompt from the Agent
    prompt_found = await check_for_file(filename=f'{promptDirectory}prompt_res_{f_name[:-3]}txt',directory=promptDirectory)

    if prompt_found:
        with open(f'{promptDirectory}prompt_res_{f_name[:-3]}txt', 'r', encoding='utf-8', errors='replace') as file:
            response = file.read()

        diffusion_task = asyncio.create_task(pass_to_diffuser(response))
        print("Image generation completed. Waiting 10 seconds before next iteration.")
        watcher = ImageWatcher(comfydir)
        
        new_image_path = await watcher.wait_for_new_file()
        if new_image_path:
            try:
                ...
                # destination_path = os.path.join(destination_folder, os.path.basename(new_image_path))
                # shutil.copy2(new_image_path, destination_path)
                # print(f"Image copied to: {destination_path}")
            except Exception as e:
                print(f"Error copying image: {e}")
        else:
                print("Timeout: No new image detected within the specified time.")


r = True
while r:
    asyncio.run(main())


# if __name__ == "__main__":

    # interval = 300  # Run every 60 seconds (1 minute)
    # try:
        # while True:
    # asyncio.run(main())
            # time.sleep(interval)
    # except KeyboardInterrupt:
    #     print("\nProgram terminated by user.")
    #     sys.exit(0)
