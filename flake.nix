{
  description = "StockDB: dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      forSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-darwin"
      ];
    in
    {
      devShells = forSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.cargo
              pkgs.rustc
              pkgs.clippy
              pkgs.rustfmt
              pkgs.rust-analyzer
              pkgs.pkg-config
              # reqwest's default TLS links against openssl, diesel's postgres backend against libpq.
              pkgs.openssl
              pkgs.postgresql
              pkgs.nodejs
            ];
            shellHook = ''
              printf '📈 \033[1m\033[38;2;241;196;15mS\033[38;2;239;184;18mt\033[38;2;237;173;21mo\033[38;2;236;161;24mc\033[38;2;234;149;28mk\033[38;2;232;138;31mD\033[38;2;230;126;34mB\033[0m  \033[2m%s\033[0m\n' 'Rust ${pkgs.rustc.version} · node ${pkgs.nodejs.version}'
              printf '  \033[32m%s\033[0m \033[2m·\033[0m \033[32m%s\033[0m\n' 'cd web && npm run build' 'cargo run'
            '';
          };
        }
      );
    };
}
