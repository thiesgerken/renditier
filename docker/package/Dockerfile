FROM archlinux/base 

RUN echo "Server = https://mirrors.kernel.org/archlinux/\$repo/os/\$arch" > /etc/pacman.d/mirrorlist 
RUN pacman -Syyu --noconfirm && rm -Rf /var/cache

RUN pacman -S dpkg git tar --noconfirm  && rm -Rf /var/cache
