{
  description = "Renditier: dev shell and container image";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    crane.url = "github:ipetkov/crane";
  };

  outputs =
    {
      self,
      nixpkgs,
      crane,
    }:
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
              # Also the server for the DB tests in CI: same major as in k3s and compose.
              pkgs.postgresql_18
              pkgs.nodejs_26
            ];
            shellHook = ''
              printf '🦌 \033[1mRendi\033[38;2;210;101;42mtier\033[0m  \033[2m%s\033[0m\n' 'Rust ${pkgs.rustc.version} · node ${pkgs.nodejs_26.version}'
              printf '  \033[32m%s\033[0m \033[2m·\033[0m \033[32m%s\033[0m\n' 'cd web && npm run build' 'cargo run'
            '';
          };
        }
      );

      packages.x86_64-linux =
        let
          pkgs = nixpkgs.legacyPackages.x86_64-linux;
          inherit (pkgs) lib;
          craneLib = crane.mkLib pkgs;

          web = pkgs.buildNpmPackage {
            pname = "renditier-web";
            version = "0.1.0";
            src = ./web;
            nodejs = pkgs.nodejs_26;
            npmDeps = pkgs.importNpmLock { npmRoot = ./web; };
            inherit (pkgs.importNpmLock) npmConfigHook;
            # The frontend shows the commit it was built from, and the sandbox has no git history.
            env.BUILD_COMMIT = self.shortRev or self.dirtyShortRev or "dirty";
            installPhase = "cp -r build $out";
          };

          cargoArgs = {
            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                (craneLib.fileset.commonCargoSources ./.)
                # embed_migrations! reads them at compile time.
                ./migrations
              ];
            };
            strictDeps = true;
            nativeBuildInputs = [ pkgs.pkg-config ];
            buildInputs = [
              pkgs.openssl
              pkgs.postgresql
            ];
          };

          renditier = craneLib.buildPackage (
            cargoArgs
            // {
              cargoArtifacts = craneLib.buildDepsOnly cargoArgs;
              cargoExtraArgs = "--locked --bin renditier";
              # rust-embed compiles the frontend into the binary.
              preBuild = "mkdir web && cp -r ${web} web/build";
              # The CI check job runs the tests.
              doCheck = false;
            }
          );
        in
        {
          image = pkgs.dockerTools.streamLayeredImage {
            name = "renditier";
            config = {
              # Numeric, because the image has no /etc/passwd to resolve a name and Kubernetes'
              # runAsNonRoot can only verify a numeric user.
              User = "65534:65534";
              Cmd = [
                "renditier"
                "serve"
              ];
              Env = [
                # Receipts can be parsed with poppler's pdftotext, run as a subprocess.
                "PATH=${
                  lib.makeBinPath [
                    renditier
                    pkgs.poppler-utils
                  ]
                }"
                "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
              ];
            };
          };
        };
    };
}
