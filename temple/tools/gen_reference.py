"""Generate HD reference images of Japanese temple elements with Gemini.
Reference only: agents look at these; nothing here is loaded by the scene."""
import base64, json, os, sys, urllib.request

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reference")
MODEL = "gemini-2.5-flash-image"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
STYLE = "Photorealistic architectural reference photo, golden hour dusk, warm low sun from the left, 16:9, high detail, no people, no text."
PROMPTS = {
    "01_overview": "Aerial view of a traditional Japanese Buddhist temple precinct at dusk: two-storey vermilion sanmon gate in the south, gravel approach, oval lotus pond crossed by a steep red arched taiko bridge, large main hall with sweeping hip-and-gable tiled roof at the north, five-storey pagoda to the east, red maples and pines, forested hills behind.",
    "02_main_hall": "Front three-quarter view of a Japanese Buddhist main hall (hondo): stone platform, vermilion columns, white plaster walls, complex bracket sets (tokyo) under deep eaves, dark grey kawara tile hip-and-gable roof with upturned corners, gold ornaments on ridge ends, bronze hanging lanterns along the eaves.",
    "03_pagoda": "Five-storey Japanese pagoda (goju-no-to), vermilion wood, white walls, each roof smaller going up, deep eaves with layered rafters, small bronze wind chimes hanging from each eave corner, tall bronze sorin spire with nine rings and gold finial on top.",
    "04_bridge": "Steep red lacquered Japanese arched taiko bridge over a lotus pond, wooden railings with bronze onion-shaped giboshi finials on posts, stone abutments, reflection in calm water.",
    "05_lotus_koi": "Close up of a Japanese temple lotus pond: pink lotus flowers and round leaves, orange white and red koi under the water surface, dusk light glinting.",
    "06_details": "Detail sheet photo collage of Japanese temple small objects: stone toro lantern with lit fire box, red paper chochin lantern at a gate, bronze furin wind chime, serene seated bronze Buddha face, backlit red maple leaves.",
    "07_sanmon": "Two-storey Japanese temple sanmon gate, vermilion, five bays, upper balcony with railing, tiled hip-and-gable roof, giant red paper chochin lantern hanging in the central bay, guardian niches.",
}

def gen(name, prompt):
    path = f"{OUT}/{name}.png"
    if os.path.exists(path):
        return
    body = {"contents": [{"parts": [{"text": prompt + " " + STYLE}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}}}
    req = urllib.request.Request(URL, json.dumps(body).encode(), {"Content-Type": "application/json"})
    data = json.load(urllib.request.urlopen(req, timeout=300))
    for part in data["candidates"][0]["content"]["parts"]:
        if "inlineData" in part:
            open(path, "wb").write(base64.b64decode(part["inlineData"]["data"]))
            print("wrote", path)
            return
    print("no image for", name, json.dumps(data)[:300])

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for k, p in PROMPTS.items():
        if len(sys.argv) < 2 or k in sys.argv[1:]:
            try:
                gen(k, p)
            except Exception as e:
                print("failed", k, e)
