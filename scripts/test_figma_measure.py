"""Checks the measuring code against shapes drawn at known sizes.  Run: python3 -m unittest scripts/test_figma_measure.py"""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from PIL import Image, ImageDraw
import figma_measure as m


def drawn(w, h, r, fill, bg=(255, 255, 255), pad=20, outline=None):
    im = Image.new("RGB", (w + 2 * pad, h + 2 * pad), bg)
    ImageDraw.Draw(im).rounded_rectangle((pad, pad, pad + w - 1, pad + h - 1), radius=r, fill=fill, outline=outline)
    return im


class Measure(unittest.TestCase):
    def test_size_and_radius_of_a_button(self):
        for r in (0, 4, 12, 28):
            im = drawn(340, 56, r, (235, 255, 62))
            b = m.region_bbox(im, (40, 48), tol=2)
            self.assertEqual(m.size(b), (340, 56))
            self.assertLessEqual(abs(m.corner_radius(im, b) - r), 2, f"radius {r}")

    def test_subtle_field_on_white(self):
        im = drawn(343, 56, 8, (245, 246, 250))
        b = m.region_bbox(im, (40, 48), tol=2)
        self.assertEqual(m.size(b), (343, 56))
        self.assertLessEqual(abs(m.corner_radius(im, b) - 8), 2)

    def test_finds_rectangles_even_with_text_inside(self):
        im = drawn(340, 56, 8, (37, 78, 162))
        ImageDraw.Draw(im).rectangle((150, 38, 230, 58), fill=(255, 255, 255))  # "text" across the middle
        rects = [r for r in m.flat_rects(im, min_w=100, min_h=30, max_h=80) if r[4] == (37, 78, 162)]
        self.assertTrue(rects)
        b = m.region_bbox(im, (40, 48), tol=2)
        self.assertEqual(m.size(b), (340, 56))

    def test_border_and_background(self):
        im = drawn(340, 48, 8, (255, 255, 255), bg=(240, 240, 245), outline=(226, 232, 240))
        self.assertEqual(m.hexc(m.background(im)), "#F0F0F5")
        self.assertEqual(m.border(im, (20, 20, 359, 67)), "#E2E8F0")


if __name__ == "__main__":
    unittest.main()
