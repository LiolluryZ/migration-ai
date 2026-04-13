from django.urls import path

from comments import views

urlpatterns = [
    path("article/<slug:slug>/comment", views.comment_create_view, name="comment_create"),
    path("article/<slug:slug>/comment/<int:comment_id>/delete", views.comment_delete_view, name="comment_delete"),
]
