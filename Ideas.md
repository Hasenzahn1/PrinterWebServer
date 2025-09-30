# Ideas/Design Concept

## Mod
The mod adds a button to the Menu that when clicked will allow for a 5s Positioning with a resulting image being taken (with shaders/noGui/etc)
The Images as well as a key value <string, string> store is sent to the api/nextcloud.

Data being sent:
 - Image
 - PC Name
 - (Playername)
 - (Plot coords)

## Server
The server has either an api or pulls the nextcloud every x seconds.
New images are added to the queue. 
It is possible to apply an overlay as well as texts that can use the variables passed from the mod using %variablename%.
The overlay is added ontop of the image.