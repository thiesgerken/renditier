FROM archlinux/base

RUN echo "Server = https://mirrors.kernel.org/archlinux/\$repo/os/\$arch" > /etc/pacman.d/mirrorlist 
RUN pacman -Syyu --noconfirm && rm -Rf /var/cache

RUN pacman -Syyu npm git --noconfirm && rm -Rf /var/cache
RUN npm install -g yarn gulp
