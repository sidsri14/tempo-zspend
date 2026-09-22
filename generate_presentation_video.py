import os
import sys
import asyncio
import subprocess
import edge_tts

# Force utf-8 stdout
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SLIDES = [
    {
        "frame": "demo/frames/slide-01.png",
        "audio": "demo/audio-01.mp3",
        "clip": "demo/clip-01.mp4",
        "text": "Z-Spend: an agentic treasury whose budget is enforced on-chain. An AI agent that physically cannot overspend, even if its own private key is compromised."
    },
    {
        "frame": "demo/frames/slide-02.png",
        "audio": "demo/audio-02.mp3",
        "clip": "demo/clip-02.mp4",
        "text": "Agentic AI now holds and spends real money, but trusting the agent always fails. Traditional multisigs do not scale to real-time autonomous actions. A single misconfigured policy or stolen key can instantly drain an entire treasury."
    },
    {
        "frame": "demo/frames/slide-03.png",
        "audio": "demo/audio-03.mp3",
        "clip": "demo/clip-03.mp4",
        "text": "Z-Spend introduces two unbreakable legs of defense. Leg one is a fail-closed policy engine: daily per-category caps, per-recipient caps, a max single payment limit, and an immutable reserve floor, verified against an append-only ledger."
    },
    {
        "frame": "demo/frames/slide-04.png",
        "audio": "demo/audio-04.mp3",
        "clip": "demo/clip-04.mp4",
        "text": "Leg two is the blockchain itself. The AI agent signs as a native Tempo account access key, configured with an immutable 100 dollar per day pathUSD spending limit and scoped strictly to token transfers. Tempo's validator protocol enforces this allowance directly at transaction validation."
    },
    {
        "frame": "demo/frames/slide-05.png",
        "audio": "demo/audio-05.mp3",
        "clip": "demo/clip-05.mp4",
        "text": "This is live on Tempo testnet. Our running ledger proves it: an 80 dollar ops payment succeeded; a 160 dollar marketing spend was rejected by policy; and on payment three, even though policy passed, the key had reached its limit, and the blockchain reverted the transaction. That is the on-chain guarantee in action."
    },
    {
        "frame": "demo/frames/slide-06.png",
        "audio": "demo/audio-06.mp3",
        "clip": "demo/clip-06.mp4",
        "text": "Who needs this? DeFi treasuries, DAOs, autonomous trading agents, AI payment middleware, and automated payroll systems. Any application where algorithms move capital and require a deterministic, unbreachable ceiling."
    },
    {
        "frame": "demo/frames/slide-07.png",
        "audio": "demo/audio-07.mp3",
        "clip": "demo/clip-07.mp4",
        "text": "That is the fundamental difference between software that asks nicely, and software that physically cannot spend what it no longer has. Z-Spend: native to Tempo, live on testnet, and ready to scale to mainnet."
    }
]

VOICE = "en-US-ChristopherNeural"

async def generate_voiceovers():
    print(f"Generating AI voiceovers using {VOICE}...")
    for i, slide in enumerate(SLIDES):
        print(f"Generating slide {i+1} audio...")
        communicate = edge_tts.Communicate(slide["text"], VOICE, rate="+3%", pitch="+0Hz")
        await communicate.save(slide["audio"])
    print("All 7 voiceovers generated successfully!")

def get_audio_duration(audio_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
        audio_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return float(result.stdout.strip())

def create_video_clips():
    print("Rendering 1080p video clips with synchronized slide images and AI audio...")
    clip_list_path = "demo/clips_list.txt"
    with open(clip_list_path, "w") as f:
        for i, slide in enumerate(SLIDES):
            dur = get_audio_duration(slide["audio"]) + 0.8
            print(f"Rendering Clip {i+1}: duration {dur:.2f}s...")
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", slide["frame"],
                "-i", slide["audio"],
                "-c:v", "libx264", "-tune", "stillimage",
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-t", str(dur),
                slide["clip"]
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            f.write(f"file '{os.path.abspath(slide['clip']).replace('\\', '/')}'\n")

    print("Concatenating all 7 clips into demo/z-spend-presentation.mp4...")
    final_output = "demo/z-spend-presentation.mp4"
    concat_cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", clip_list_path,
        "-c", "copy",
        final_output
    ]
    subprocess.run(concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    
    total_dur = get_audio_duration(final_output)
    file_size_mb = os.path.getsize(final_output) / (1024 * 1024)
    print(f"FINAL PRESENTATION VIDEO GENERATED: {final_output}")
    print(f"Total Duration: {total_dur:.1f} seconds (~{total_dur/60:.1f} mins)")
    print(f"File Size: {file_size_mb:.2f} MB (1080p, H.264 + AAC)")

if __name__ == "__main__":
    asyncio.run(generate_voiceovers())
    create_video_clips()

