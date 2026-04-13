import markdown as md
import nh3
from django import template
from django.utils.safestring import mark_safe

register = template.Library()


@register.filter(name="render_markdown")
def render_markdown(value):
    return mark_safe(nh3.clean(md.markdown(value, extensions=["extra"])))
