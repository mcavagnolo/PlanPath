from PIL import Image
import os

def get_bg_color(image_path):
    try:
        if not os.path.exists(image_path):
            return f"File not found: {image_path}"
            
        img = Image.open(image_path)
        # Get the color of the top-left pixel
        pixel = img.getpixel((0, 0))
        
        # Handle RGBA
        if len(pixel) == 4:
            r, g, b, a = pixel
            # If fully transparent, we can't really pick a color, but let's see
            if a == 0:
                return "Transparent"
        elif len(pixel) == 3:
            r, g, b = pixel
        else:
            return f"Unknown pixel format: {pixel}"
        
        return '#{:02x}{:02x}{:02x}'.format(r, g, b)
    except Exception as e:
        return str(e)

print(f"Logo Color: {get_bg_color('public/logos/PlanPath Logo.png')}")
